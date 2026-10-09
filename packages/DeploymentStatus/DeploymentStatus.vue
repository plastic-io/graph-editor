<template>
  <v-menu v-if="serverMode" v-model="open" :close-on-content-click="false" location="top">
    <template v-slot:activator="{props}">
      <v-badge :content="stacks.length" :model-value="stacks.length > 0" :color="badgeColor" overlap>
        <v-icon help-topic="deployment-status" icon="mdi-cloud-outline" v-bind="props" class="ma-2" title="What this graph deploys"/>
      </v-badge>
    </template>
    <v-card width="620" @click.stop @mousemove.stop>
      <v-card-title class="d-flex align-center">
        Infrastructure
        <v-spacer/>
        <v-btn size="x-small" variant="text" icon="mdi-refresh" title="Refresh" :loading="busy" @click="refresh"/>
      </v-card-title>
      <v-card-text>
        <v-alert v-if="message" density="compact" type="warning" variant="tonal" class="mb-2" closable @click:close="message = ''">{{ message }}</v-alert>
        <v-alert v-if="!canPlan && stacks.length" density="compact" type="info" variant="tonal" class="mb-2">
          <small>This server holds no CloudFormation authority, so it can check a template and not ask what deploying it would do.</small>
        </v-alert>
        <v-list density="compact" max-height="60vh" style="overflow-y: auto">
          <v-list-item v-for="s in stacks" :key="s.nodeId" :title="s.name" :subtitle="subtitleFor(s)">
            <template v-slot:prepend>
              <v-icon :color="colorFor(s)" :title="stateOf(s)">{{ iconFor(s) }}</v-icon>
            </template>
            <template v-slot:append>
              <v-btn v-if="canPlan" size="x-small" variant="text" icon="mdi-magnify-scan" title="Review infrastructure changes" aria-label="Review infrastructure changes" :loading="planning === s.nodeId" @click.stop="plan(s)"/>
            </template>

            <div v-if="problemsOf(s).length" class="mt-1">
              <div v-for="(p, i) in problemsOf(s)" :key="i" class="text-error"><small>{{ p.resource ? p.resource + ': ' : '' }}{{ p.message }}</small></div>
            </div>

            <div v-if="planOf(s)" class="mt-1">
              <small :class="planOf(s).destructive ? 'text-warning' : 'text-disabled'">
                {{ changeLine(planOf(s)) }}
              </small>
              <div v-for="c in planOf(s).changes" :key="c.logicalId">
                <small class="text-disabled">{{ c.action }} {{ c.logicalId }} ({{ c.resourceType }}){{ c.replacement && c.replacement !== 'False' ? ' — replaced' : '' }}</small>
              </div>
            </div>

            <div v-if="reasonOf(s)" class="mt-1 text-error"><small>{{ reasonOf(s) }}</small></div>
          </v-list-item>
          <v-list-item v-if="!stacks.length && !busy"
            title="This graph describes no infrastructure"
            subtitle="A node carrying a CloudFormation template appears here, with what deploying it would do"/>
        </v-list>
      </v-card-text>
    </v-card>
  </v-menu>
  <v-btn v-if="serverMode && canReview" data-testid="infra-auto-approve" size="small" :color="autoApprove ? 'warning' : undefined" :variant="autoApprove ? 'tonal' : 'text'" :aria-pressed="autoApprove" @click="toggleAutoApproval">Auto-approve: {{ autoApprove ? 'on' : 'off' }}</v-btn>
  <v-dialog v-model="autoWarningOpen" max-width="580">
    <v-card data-testid="auto-approve-warning"><v-card-title>Enable infrastructure auto-approval?</v-card-title><v-card-text>
      <v-alert type="warning" variant="tonal">This editor will approve eligible infrastructure reviews as you, without a confirmation for each digest. This can create billable resources and change IAM permissions.</v-alert>
      <p>Stack deletion is never auto-approved. Resource removals, replacements, rollback actions and data-loss recovery plans also require manual review.</p>
      <p>This applies only to the current graph while this editor is open. It turns off on reload or graph change. Turning it off does not cancel operations already approved.</p>
    </v-card-text><v-card-actions><v-btn @click="autoWarningOpen=false">Keep off</v-btn><v-spacer/><v-btn color="warning" variant="flat" @click="enableAutoApproval">Enable auto-approval</v-btn></v-card-actions></v-card>
  </v-dialog>
  <v-menu v-if="serverMode && canReview && stacks.length" v-model="recoveryMenuOpen" :close-on-content-click="false" location="top">
    <template #activator="{props}"><v-btn v-bind="props" variant="text" size="small" prepend-icon="mdi-lifebuoy" data-testid="recovery-system-action" @click="refresh">Recovery<v-badge v-if="recoveryCount" inline :content="recoveryCount" color="warning"/></v-btn></template>
    <v-list density="compact" max-height="60vh" style="overflow-y:auto" aria-label="Infrastructure recovery">
      <v-list-item v-for="s in stacks" :key="s.nodeId" :title="s.name" :subtitle="stateOf(s)" @click="openRecovery(s)"><template #append><v-btn variant="text" size="small" @click.stop="openRecovery(s)">Review recovery</v-btn></template></v-list-item>
    </v-list>
  </v-menu>
  <v-dialog v-model="recoveryOpen" max-width="900" scrollable>
    <v-card v-if="recoverySelected" data-testid="system-recovery-review">
      <v-card-title class="d-flex align-center">Infrastructure recovery · {{ recoverySelected.name }}<v-spacer/><v-btn icon="mdi-close" variant="text" aria-label="Close recovery review" @click="recoveryOpen=false"/></v-card-title>
      <v-card-subtitle>{{ recoverySelected.stack.name }} · {{ recoverySelected.stack.account }} · {{ recoverySelected.stack.region }}</v-card-subtitle>
      <v-card-text><p v-if="recoveryError" role="alert">{{ recoveryError }}</p><deployment-lifecycle :graph-id="graphId()" :node-id="recoverySelected.nodeId" :status="recoveryStatus" @refresh="refreshRecovery"/></v-card-text>
    </v-card>
  </v-dialog>
  <v-dialog v-model="reviewOpen" max-width="900" scrollable>
    <v-card v-if="selected" data-testid="infrastructure-review">
      <v-card-title class="d-flex align-center">Review infrastructure · {{ selected.name }}<v-spacer/><v-btn icon="mdi-close" variant="text" aria-label="Close infrastructure review" @click="reviewOpen = false"/></v-card-title>
      <v-card-subtitle>{{ selected.stack.name }} · {{ selected.stack.account }} · {{ selected.stack.region }}</v-card-subtitle>
      <v-card-text>
        <v-alert v-if="reviewMessage" type="error" variant="tonal" class="mb-3">{{ reviewMessage }}</v-alert>
        <v-alert v-if="!canReview" type="info" variant="tonal" class="mb-3">This server supports previews only. Reviewed apply is not enabled.</v-alert>
        <div v-if="reviewBusy || pendingReview" class="mb-3"><v-progress-linear indeterminate class="mb-2"/>{{ reviewStatus?.state === 'applying' || reviewStatus?.state === 'apply-requested' ? 'Applying the approved changes in AWS…' : 'Preparing the CloudFormation review…' }}</div>
        <v-alert v-if="reviewStatus" :type="reviewStatus.state === 'succeeded' ? 'success' : ['failed','rollback-failed','rolled-back'].includes(reviewStatus.state) ? 'error' : 'info'" variant="tonal" class="mb-3">
          <strong>{{ reviewStateLabel }}</strong><div v-if="reviewStatus.reason">{{ reviewStatus.reason }}</div>
          <div v-if="reviewStatus.manualRecoveryRequired">Read the resource failures and recovery guidance below before retrying. This stack is locked for recovery.</div>
        </v-alert>
        <deployment-progress :recovery-controls="false" v-if="canReview && selected" :graph-id="graphId()" :node-id="selected.nodeId" @status="reviewStatus = $event"/>
        <v-table v-if="reviewStatus?.plan" density="compact" class="mb-3">
          <thead><tr><th>Change</th><th>Resource</th><th>Type</th><th>Replacement</th><th>Retention</th></tr></thead>
          <tbody><tr v-for="(change,i) in reviewStatus.plan.changes" :key="i"><td>{{ change.action }}</td><td>{{ change.logicalId }}</td><td>{{ change.resourceType }}</td><td>{{ change.replacement || '—' }}</td><td>{{ change.outcome || change.policyAction || (change.replacement && change.replacement !== 'False' ? change.updateReplacePolicy : change.deletionPolicy) || 'See template' }}</td></tr></tbody>
        </v-table>
        <p v-if="reviewStatus?.plan && !reviewStatus.plan.changes.length">The stack already matches; there are no changes to apply.</p>
        <v-alert v-if="reviewStatus?.preflight" type="info" variant="tonal" class="mb-3">
          <div>Stack namespace: {{ reviewStatus.preflight.isolation.namespace }}</div>
          <div>Template checks do not verify AWS permissions or application readiness.</div>
          <div v-for="(problem,i) in reviewStatus.preflight.problems" :key="i">{{ problem.path }}: {{ problem.message }}</div>
        </v-alert>
        <v-expansion-panels v-if="reviewStatus?.template" class="mb-3">
          <v-expansion-panel v-if="accessChanges.length" title="IAM and resource policy changes"><v-expansion-panel-text><pre class="review-template">{{ JSON.stringify(accessChanges, null, 2) }}</pre></v-expansion-panel-text></v-expansion-panel>
          <v-expansion-panel v-if="reviewStatus?.preflight" title="Deployment permissions and prerequisites"><v-expansion-panel-text><pre class="review-template">{{ JSON.stringify({deploymentRole:reviewStatus.preflight.deploymentRole,permissionsBoundary:reviewStatus.preflight.permissionsBoundary,requirements:reviewStatus.preflight.requirements}, null, 2) }}</pre></v-expansion-panel-text></v-expansion-panel>
          <v-expansion-panel title="Reviewed CloudFormation template"><v-expansion-panel-text><pre class="review-template">{{ reviewStatus.template.text }}</pre></v-expansion-panel-text></v-expansion-panel>
        </v-expansion-panels>
        <v-table v-if="reviewStatus?.outputs?.length" density="compact"><thead><tr><th>Output</th><th>Value</th></tr></thead><tbody><tr v-for="output in reviewStatus.outputs" :key="output.key"><td>{{ output.key }}</td><td class="text-break">{{ output.value }}</td></tr></tbody></v-table>
        <v-alert v-if="reviewStatus?.plan?.destructive && reviewStatus?.state === 'awaiting-review'" type="warning" variant="tonal" class="mt-3">This change removes or replaces resources. Review the affected resources before applying.</v-alert>
        <v-checkbox v-if="reviewStatus?.plan?.destructive && reviewStatus?.state === 'awaiting-review'" v-model="confirmDestructive" label="I approve the listed resource removals or replacements" hide-details/>
        <p v-if="reviewStatus?.state === 'awaiting-review'" class="mt-3 text-caption">Approval applies exactly this review. Editing the template or stack settings requires a new review.</p>
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="canReview && ['planning','awaiting-review'].includes(reviewStatus?.state)" :disabled="reviewBusy" @click="discardReview">Discard review</v-btn>
        <v-spacer/>
        <v-btn v-if="canReview && reviewStatus?.state === 'succeeded' && reviewStatus?.stack?.name?.startsWith('gapp-')" color="warning" @click="plan(selected, true, 'destroy')">Review stack deletion</v-btn>
        <v-btn v-if="!pendingReview && !reviewBusy" @click="plan(selected, true)">Create new review</v-btn>
        <v-btn v-if="canReview && reviewStatus?.state === 'awaiting-review'" color="primary" variant="flat" :loading="reviewBusy" :disabled="reviewStatus.plan.destructive && !confirmDestructive" @click="applyReview">{{ reviewStatus?.action === 'destroy' ? 'Approve stack deletion' : 'Approve and apply' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script lang="ts">
import {mapState} from "pinia";
import DeploymentProgress from "./DeploymentProgress.vue";
import DeploymentLifecycle from "./DeploymentLifecycle.vue";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";

/**
 * What this graph deploys (plan §4.9, PB-094).
 *
 * A node carrying a template is a piece of infrastructure the graph describes,
 * and until now the only way to find out what it would do was to be an agent
 * calling `iac.plan`.  This asks the same service the same questions: whether
 * the template is one this environment allows, and — where the server can ask
 * CloudFormation — what the change would add, change or take away.
 *
 * Reviewed applies use an immutable change set and a server-verified approval.
 */
export default {
  name: "deployment-status",
  components:{DeploymentProgress,DeploymentLifecycle},
  data() {
    return {
      open: false,
      autoApprove:false,autoWarningOpen:false,autoBusy:false,autoTimer:null as any,autoGeneration:0,autoAttempts:{} as Record<string,boolean>,
      recoveryMenuOpen:false,recoveryOpen:false,recoverySelected:null as any,recoveryStatus:null as any,recoveryError:'',recoveryTimer:null as any,detachBus:null as any,busTimer:null as any,
      busy: false,
      planning: "",
      message: "",
      stacks: [] as any[],
      canPlan: false,
      canReview: false,
      selected: null as any,
      reviewStatus: null as any,
      reviewOpen: false,
      reviewBusy: false,
      reviewMessage: '',
      confirmDestructive: false,
      reviewTimer: null as any,
      reviewGeneration: 0,
    };
  },
  beforeUnmount() { clearTimeout(this.reviewTimer);clearTimeout(this.recoveryTimer);clearTimeout(this.busTimer);this.disableAutoApproval();this.detachBus?.(); this.reviewGeneration++; },
  watch: {
    recoveryOpen(value:boolean){if(!value)clearTimeout(this.recoveryTimer);},
    reviewOpen(value: boolean) { if (!value) { clearTimeout(this.reviewTimer); this.reviewGeneration++; this.planning=""; this.reviewBusy=false; } },
    'graph.id'() { this.disableAutoApproval();this.autoWarningOpen=false;this.reviewOpen=false; this.selected=null; this.reviewStatus=null; this.refresh(); },
    open(isOpen: boolean) {
      if (isOpen) {
        this.refresh();
      }
    },
    graphLoaded(loaded: boolean) {
      if (loaded && this.open) {
        this.refresh();
      }
    },
  },
  mounted() {
    this.listen();
    if ((this as any).graphLoaded) {
      this.refresh();
    }
  },
  computed: {
    recoveryCount():number{return this.stacks.filter((s:any)=>s.status?.manualRecoveryRequired || ['recovery-ready','recovery-blocked','recovery-requested','recovering','failed','rolled-back','rollback-failed'].includes(s.status?.state)).length;},
    accessChanges(): any[] { return (this.reviewStatus?.plan?.changes || []).filter((c: any)=>c.access).map((c: any)=>({logicalId:c.logicalId,action:c.action,resourceType:c.resourceType,...c.access})); },
    pendingReview(): boolean { return ['planning','apply-requested','applying'].includes(this.reviewStatus?.state); },
    reviewStateLabel(): string {
      const labels: any={'awaiting-review':'Ready for your approval',planned:'Preview complete',planning:'Preparing review',
        'apply-requested':'Approval recorded',applying:'Applying changes',succeeded:'Deployment complete',failed:'Deployment failed',
        'rolled-back':'AWS rolled back the deployment','rollback-failed':'Rollback needs attention',cancelled:'Review discarded',expired:'Review expired','no-changes':'No changes needed',destroyed:'Stack deleted'};
      return labels[this.reviewStatus?.state] || this.reviewStatus?.state || '';
    },
    ...mapState(useGraphStore, ["graphLoaded", "graph"]),
    serverMode(): boolean {
      const prefs = (usePreferencesStore() as any).preferences;
      return !!prefs && !prefs.useLocalStorage;
    },
    badgeColor(): string {
      if (this.stacks.some((s: any) => this.problemsOf(s).length || this.reasonOf(s))) {
        return "error";
      }
      return this.stacks.some((s: any) => this.planOf(s) && this.planOf(s).destructive) ? "warning" : "info";
    },
  },
  methods: {
    disableAutoApproval(){this.autoApprove=false;this.autoGeneration++;clearTimeout(this.autoTimer);},
    toggleAutoApproval(){if(this.autoApprove)this.disableAutoApproval();else this.autoWarningOpen=true;},
    enableAutoApproval(){this.autoWarningOpen=false;this.autoApprove=true;this.autoAttempts={};this.autoGeneration++;this.autoTick();},
    async autoTick(){
      clearTimeout(this.autoTimer);if(!this.autoApprove||!this.serverMode)return;
      await this.refresh();
      if(this.autoApprove)this.autoTimer=setTimeout(()=>this.autoTick(),5000);
    },
    async maybeAutoApprove(){
      if(!this.autoApprove||this.autoBusy)return;this.autoBusy=true;const generation=this.autoGeneration,graphId=this.graphId();
      try{
        for(const stack of this.stacks){
          if(!['awaiting-review','recovery-ready'].includes(stack.status?.state))continue;
          const answer=await this.provider().stackReview(graphId,stack.nodeId),status=answer.status;
          if(!this.autoApprove||this.autoGeneration!==generation||this.graphId()!==graphId)return;
          if(status?.automaticApproval?.allowed!==true)continue;
          const recovery=status.action==='recover',digest=recovery?status.recoveryPlan?.digest:status.reviewDigest,key=stack.nodeId+':'+status.operationId+':'+digest;
          if(!digest||this.autoAttempts[key])continue;
          // The server repeats eligibility, ownership, expiry and exact-digest checks.
          this.autoAttempts[key]=true;
          const result=recovery?await this.provider().approveRecovery(graphId,stack.nodeId,{operationId:status.operationId,recoveryDigest:digest,approvalMode:'automatic',confirmDataLoss:false}):await this.provider().applyStack(graphId,stack.nodeId,{operationId:status.operationId,reviewDigest:digest,approvalMode:'automatic',confirmDestructive:false});
          if(this.graphId()===graphId){stack.status=result.status;if(this.recoverySelected?.nodeId===stack.nodeId)this.recoveryStatus=result.status;}
        }
      }catch(error:any){if(this.autoGeneration===generation){this.disableAutoApproval();this.message='Auto-approval stopped: '+(error.message||'Approval was refused.');}}
      finally{this.autoBusy=false;}
    },
    listen(){
      this.detachBus?.();const bus:any=(useOrchestratorStore() as any).dataProviders.graph,graphId=this.graphId(),channel='graph-notify-'+graphId;
      if(!bus?.subscribe||!graphId)return;
      const receive=(wrapped:any)=>{const event=wrapped?.response||wrapped;if(event?.eventType!=='deployment.progress'||event.provenance!=='server'||event.graphId!==graphId)return;clearTimeout(this.busTimer);this.busTimer=setTimeout(()=>{this.refresh();if(this.recoveryOpen)this.refreshRecovery();},300);};
      bus.subscribe(channel,receive);const off=bus.onOpen?.(()=>{this.refresh();if(this.recoveryOpen)this.refreshRecovery();});this.detachBus=()=>{bus.unsubscribe(channel,receive);off?.();};
    },
    async openRecovery(stack:any){this.recoveryMenuOpen=false;this.recoverySelected=stack;this.recoveryStatus=stack.status;this.recoveryError='';this.recoveryOpen=true;await this.refreshRecovery();},
    async refreshRecovery(){
      clearTimeout(this.recoveryTimer);const graphId=this.graphId(),nodeId=this.recoverySelected?.nodeId;if(!this.recoveryOpen||!nodeId)return;
      try{const answer=await this.provider().stackReview(graphId,nodeId);if(!this.recoveryOpen||this.graphId()!==graphId||this.recoverySelected?.nodeId!==nodeId)return;this.recoveryStatus=answer.status;this.recoveryError='';}
      catch(error:any){if(this.recoveryOpen&&this.graphId()===graphId)this.recoveryError=error.message;}
      if(this.recoveryOpen&&this.graphId()===graphId)this.recoveryTimer=setTimeout(()=>this.refreshRecovery(),5000);
    },
    /**
     * The provider that speaks to the graph server's own routes.  Not
     * `dataProviders.graph` — that one syncs the document and knows nothing
     * about what the server can be asked, so reaching for it left this panel
     * empty and silent.  The one that answers is whichever sync provider
     * offers the call, which is how the executions panel finds it too.
     */
    provider(): any {
      const orchestrator = useOrchestratorStore() as any;
      return (orchestrator.syncProviders || []).find((p: any) => typeof p.listStacks === "function");
    },
    graphId(): string {
      return (this as any).graph && (this as any).graph.id;
    },
    async refresh() {
      const graphId = this.graphId();
      if (!graphId) {
        return;
      }
      const provider = this.provider();
      if (!provider) {
        // Silence here reads as "this graph deploys nothing", which is a
        // different thing from "nothing here can ask".
        this.stacks = [];
        this.canPlan = false;
        this.message = "Nothing here can ask this server about stacks; it may be older than this editor.";
        return;
      }
      this.busy = true;
      try {
        const answer = await provider.listStacks(graphId);
        this.stacks = (answer && answer.stacks) || [];
        this.canPlan = !!(answer && answer.canPlan);
        this.canReview = !!answer?.canReview;
      } catch (err: any) {
        this.message = err.message || String(err);
      }
      this.busy = false;
      await this.maybeAutoApprove();
    },
    async plan(stack: any, replace = false, action = 'apply') {
      clearTimeout(this.reviewTimer);
      const generation=++this.reviewGeneration, graphId=this.graphId();
      this.selected=stack;this.reviewOpen=true;this.reviewBusy=true;this.reviewMessage='';this.message='';this.confirmDestructive=false;
      this.reviewStatus=replace ? null : stack.status;
      this.planning=stack.nodeId;
      try {
        const answer=this.canReview && stack.status?.operationId && !replace
          ? await this.provider().stackReview(graphId,stack.nodeId)
          : await this.provider().planStack(graphId,stack.nodeId,replace,action);
        if(generation!==this.reviewGeneration || graphId!==this.graphId())return;
        this.reviewStatus=answer.status || answer;
        stack.status=this.reviewStatus;
        this.scheduleReviewPoll(generation,graphId,stack.nodeId);
      }catch(err:any){if(generation===this.reviewGeneration){this.reviewMessage=err.message || String(err);this.message=this.reviewMessage;}}
      finally {if(generation===this.reviewGeneration){this.reviewBusy=false;this.planning='';}}
      await this.refresh();
    },
    scheduleReviewPoll(generation: number, graphId: string, nodeId: string) {
      if(!this.reviewOpen || !this.reviewStatus?.operationId || !['planning','awaiting-review','apply-requested','applying'].includes(this.reviewStatus.state))return;
      clearTimeout(this.reviewTimer);
      this.reviewTimer=setTimeout(async()=>{
        try {
          const answer=await this.provider().stackReview(graphId,nodeId);
          if(generation!==this.reviewGeneration || graphId!==this.graphId())return;
          if(answer.status){this.reviewStatus=answer.status;const stack=this.stacks.find((s:any)=>s.nodeId===nodeId);if(stack)stack.status=answer.status;}
        }catch(err:any){if(generation===this.reviewGeneration)this.reviewMessage=err.message || String(err);}
        if(generation===this.reviewGeneration)this.scheduleReviewPoll(generation,graphId,nodeId);
      },2000);
    },
    async applyReview() {
      this.reviewBusy=true;this.reviewMessage='';
      const generation=this.reviewGeneration,graphId=this.graphId(),nodeId=this.selected.nodeId;
      try {
        const answer=await this.provider().applyStack(graphId,nodeId,{operationId:this.reviewStatus.operationId,reviewDigest:this.reviewStatus.reviewDigest,confirmDestructive:this.confirmDestructive});
        if(generation!==this.reviewGeneration)return;
        this.reviewStatus=answer.status;this.scheduleReviewPoll(generation,graphId,nodeId);
      }catch(err:any){if(generation===this.reviewGeneration)this.reviewMessage=err.message || String(err);}
      finally {if(generation===this.reviewGeneration)this.reviewBusy=false;}
    },
    async discardReview() {
      this.reviewBusy=true;this.reviewMessage='';
      const generation=this.reviewGeneration;
      try {
        const answer=await this.provider().discardStackReview(this.graphId(),this.selected.nodeId,this.reviewStatus.operationId);
        if(generation!==this.reviewGeneration)return;
        this.reviewStatus=answer.status;clearTimeout(this.reviewTimer);await this.refresh();
      }catch(err:any){if(generation===this.reviewGeneration)this.reviewMessage=err.message || String(err);}
      finally {if(generation===this.reviewGeneration)this.reviewBusy=false;}
    },
    stateOf(stack: any): string {
      if (this.problemsOf(stack).length) {
        return "this environment would refuse this template";
      }
      return (stack.status && stack.status.state) || "never planned";
    },
    planOf(stack: any): any {
      return stack.status && stack.status.plan;
    },
    problemsOf(stack: any): any[] {
      const fromTemplate = (stack.validation && stack.validation.problems) || [];
      const fromPlan = (stack.status && stack.status.problems) || [];
      return fromTemplate.length ? fromTemplate : fromPlan;
    },
    reasonOf(stack: any): string {
      return (stack.status && !this.problemsOf(stack).length && stack.status.reason) || "";
    },
    subtitleFor(stack: any): string {
      const where = `${stack.stack.name} · ${stack.stack.region} · ${stack.stack.environment}`;
      const counted = stack.validation ? `${stack.validation.counts.resources} resource${stack.validation.counts.resources === 1 ? "" : "s"}` : "";
      return [where, counted, this.stateOf(stack)].filter(Boolean).join(" — ");
    },
    changeLine(plan: any): string {
      if (!plan.changes.length) {
        return "nothing would change: the stack already matches";
      }
      const added = plan.changes.filter((c: any) => c.action === "Add").length;
      const modified = plan.changes.filter((c: any) => c.action === "Modify").length;
      const removed = plan.changes.filter((c: any) => c.action === "Remove").length;
      const parts = [added && `${added} added`, modified && `${modified} changed`, removed && `${removed} removed`].filter(Boolean);
      return parts.join(", ") + (plan.destructive ? " — this takes something away" : "");
    },
    iconFor(stack: any): string {
      if (this.problemsOf(stack).length) {
        return "mdi-close-octagon-outline";
      }
      const state = (stack.status && stack.status.state) || "";
      if (["planned", "awaiting-review", "succeeded", "no-changes"].includes(state)) {
        return this.planOf(stack) && this.planOf(stack).destructive ? "mdi-alert-outline" : "mdi-check-circle-outline";
      }
      if (["failed", "rollback-failed", "rolled-back"].includes(state)) {
        return "mdi-alert-circle-outline";
      }
      return "mdi-cloud-question-outline";
    },
    colorFor(stack: any): string {
      if (this.problemsOf(stack).length) {
        return "error";
      }
      const state = (stack.status && stack.status.state) || "";
      if (state === "failed") {
        return "error";
      }
      if (state === "planned") {
        return this.planOf(stack) && this.planOf(stack).destructive ? "warning" : "success";
      }
      return "info";
    },
  },
};
</script>

<style scoped>.review-template {white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;max-height:360px;overflow:auto;}</style>
