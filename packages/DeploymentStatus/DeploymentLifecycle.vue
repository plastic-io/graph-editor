<template>
  <div class="lifecycle" :class="{'lifecycle--modal':modal}" :aria-busy="busy" data-testid="deployment-lifecycle" @mousedown.stop @mouseup.stop @mousemove.stop @keydown.stop @keyup.stop @wheel.stop>
    <div class="recovery-body" data-testid="recovery-scroll-body">
      <div class="recovery-toolbar">
        <span class="recovery-state" :class="'tone-'+stateTone" role="status"><span class="state-dot"/>{{ stateLabel }}</span>
        <button type="button" class="lifecycle-button subtle" :disabled="busy" @click="inspect">Check current readiness</button>
      </div>
      <dl v-if="inspection" class="recovery-summary">
        <div><dt>Application stack</dt><dd :class="'tone-'+toneFor(inspection.application?.status)">{{ inspection.application?.status }}</dd><small>Ownership: {{ inspection.application?.ownership }}</small></div>
        <div><dt>Guardrail stack</dt><dd :class="'tone-'+toneFor(inspection.guardrail?.status)">{{ inspection.guardrail?.status }}</dd><small>Ownership: {{ inspection.guardrail?.ownership }}</small></div>
        <div><dt>Worker role assumption</dt><dd>{{ inspection.assumption?.result || 'Not checked' }}</dd><small>Checked {{ time(inspection.checkedAt) }}</small></div>
      </dl>
      <p v-if="!inspection" class="muted">Check current readiness to inspect stack ownership and deployment prerequisites.</p>
      <p v-if="status?.state === 'recovered'" class="lifecycle-notice tone-success">Recovery completed. The next application deployment needs a fresh review and a separate human approval.</p>
      <p v-else-if="status?.error?.message || status?.reason" class="lifecycle-notice" :class="'tone-'+stateTone">{{ status.error?.message || status.reason }}</p>

      <section v-if="status?.recoveryPlan" class="recovery-plan" data-testid="recovery-plan">
        <div class="section-heading"><h3>Recovery plan</h3><span class="count">{{ status.recoveryPlan.actions.length }} {{ status.recoveryPlan.actions.length === 1 ? 'action' : 'actions' }}</span></div>
        <p class="retention-note" :class="status.recoveryPlan.preservesData ? 'tone-success' : 'tone-error'">{{ status.recoveryPlan.preservesData ? 'Preserves retained resources and application data.' : 'This plan includes data loss.' }}</p>
        <p v-if="includesStackDeletion" class="lifecycle-notice tone-error"><strong>Stack deletion included.</strong> Review the exact stack targets below before approving.</p>
        <ol class="recovery-actions">
          <li v-for="(action,i) in status.recoveryPlan.actions" :key="i">
            <span class="action-number">{{ i + 1 }}</span>
            <div class="action-content">
              <div class="action-heading"><strong>{{ actionLabel(action.kind) }}</strong><span class="target-label">{{ action.target }}</span><span v-if="status.recoveryOutcomes?.[i]" class="action-outcome" :class="'tone-'+toneFor(status.recoveryOutcomes[i].status)">{{ status.recoveryOutcomes[i].status || (status.recoveryOutcomes[i].done ? 'Complete' : 'In progress') }}</span></div>
              <p v-if="action.reason" class="action-reason">{{ action.reason }}</p>
              <code v-if="action.stackId" class="stack-target" data-testid="recovery-stack-target">{{ action.stackId }}</code>
              <p v-if="action.dataLoss?.length" class="deletion-warning tone-error"><strong>Data deletion:</strong> {{ action.dataLoss.join(', ') }}</p>
              <details v-if="action.resources?.length" class="resource-details" data-testid="recovery-resources">
                <summary>{{ action.resources.length }} affected {{ action.resources.length === 1 ? 'resource' : 'resources' }}<span class="summary-note">View identifiers &amp; retention</span></summary>
                <div class="resource-scroll" tabindex="0" aria-label="Affected recovery resources">
                  <table><thead><tr><th>Resource</th><th>Planned outcome</th></tr></thead><tbody><tr v-for="resource in action.resources" :key="resource.logicalId"><td><strong>{{ resource.logicalId }}</strong><code>{{ resource.physicalId }}</code></td><td :class="{'tone-error':resource.outcome === 'Delete'}">{{ resource.outcome || 'Import and retain' }}</td></tr></tbody></table>
                </div>
              </details>
            </div>
          </li>
        </ol>
        <div v-if="status.recoveryPlan.prerequisites?.length" class="lifecycle-notice tone-error"><strong>Prerequisites</strong><ul><li v-for="(item,i) in status.recoveryPlan.prerequisites" :key="i">{{ item.message }}<code>{{ item.code }}</code></li></ul></div>
      </section>

      <details v-if="inspection" class="lifecycle-section" :open="!status?.recoveryPlan" data-testid="recovery-evidence">
        <summary>Current conditions &amp; ownership<span class="summary-note">{{ inspection.blockers?.length || 0 }} {{ inspection.blockers?.length === 1 ? 'blocker' : 'blockers' }}</span></summary>
        <div class="section-body">
          <p v-if="inspection.recoveryReadiness?.state === 'review-available'" data-testid="recovery-available">Graph-owned infrastructure recovery is available for human review.<template v-if="inspection.recoveryReadiness.missingRoles?.length"> Missing deployment roles are restored using platform authority; they do not need to exist before recovery approval.</template></p>
          <div v-if="inspection.roles?.length" class="role-list"><span v-for="role in inspection.roles" :key="role.logicalId">{{ role.logicalId }}: {{ role.exists === false ? 'Absent' : role.exists === true ? 'Present' : 'Unknown — verification required' }}</span></div>
          <p v-if="inspection.activeOperation">Active operation: <code class="inline-code">{{ inspection.activeOperation.operationId }}</code> · {{ inspection.activeOperation.state }}</p>
          <ul v-if="inspection.blockers?.length" class="blocker-list"><li v-for="(item,i) in inspection.blockers" :key="i"><strong>{{ item.message }}</strong><code>{{ item.code }}</code><code v-if="item.action || item.resource">{{ item.action }} {{ item.resource }}</code></li></ul>
          <p class="muted">Policy analysis does not prove deployment will succeed.</p>
          <details v-if="inspection.historicalFailure" class="evidence-detail"><summary>Historical failure<span class="summary-note">Previous operation</span></summary><p>This is previous failure evidence, not a current permission check.</p><code>{{ inspection.historicalFailureOperationId }}</code><pre>{{ typeof inspection.historicalFailure === 'string' ? inspection.historicalFailure : inspection.historicalFailure.message }}</pre></details>
          <details class="evidence-detail"><summary>Ownership, surviving resources and permission evidence</summary><pre>{{ JSON.stringify(inspection, null, 2) }}</pre></details>
        </div>
      </details>
      <details v-if="status?.recoveryPlan" class="lifecycle-section">
        <summary>Review evidence &amp; approval scope</summary>
        <div class="section-body"><p>This graph recovery needs a human with infrastructure approval authority. Platform-maintenance administrator membership is not required.</p><dl class="review-metadata"><dt>Operation</dt><dd>{{ status.operationId }}</dd><dt>Source operation</dt><dd>{{ status.recoveryPlan.sourceOperationId }}</dd><template v-if="status.expiresAt"><dt>Review expires</dt><dd>{{ time(status.expiresAt) }}</dd></template></dl><details class="evidence-detail"><summary>Approved platform guardrail definition</summary><pre>{{ JSON.stringify(inspection?.approvedGuardrailTemplate, null, 2) }}</pre></details></div>
      </details>
      <details v-if="canPrepareRecovery && recoveryControls" class="lifecycle-section">
        <summary>Plan options<span class="summary-note">Data preservation by default</span></summary>
        <div class="section-body"><label class="checkbox-label"><input type="checkbox" v-model="allowDataLoss"/><span>Include data deletion in the next plan if safe recovery cannot preserve it. Execution still requires explicit approval of the listed deletions.</span></label></div>
      </details>
      <p v-if="!recoveryControls && (canPrepareRecovery || status?.recoveryPlan)" class="muted">Open Recovery beside the cloud notifications in the lower system bar to review and approve recovery.</p>

      <section v-if="status && (needsMaintenance || status.maintenance)" class="maintenance-section">
        <div class="section-heading"><h3>Platform maintenance</h3><span class="count">Separate review</span></div>
        <p v-if="maintenanceConfiguration?.blocker" class="lifecycle-notice tone-error" data-testid="maintenance-configuration">{{ maintenanceConfiguration.blocker.message }}</p>
        <button v-if="needsMaintenance" type="button" class="lifecycle-button" :disabled="busy" @click="maintenance('request')">Request platform maintenance review</button>
        <details v-if="status.maintenance" class="lifecycle-section" open data-testid="maintenance-request">
          <summary>Maintenance request<span class="summary-note">{{ status.maintenance.state }} · Record only</span></summary>
          <div class="section-body"><ul class="blocker-list"><li v-for="(requirement,i) in status.maintenance.requirements" :key="i"><strong>{{ requirement.component }} · {{ requirement.message }}</strong><code>{{ requirement.action }} {{ requirement.resource }}</code></li></ul>
            <p>This request only records and verifies a platform maintenance review. Requesting or approving it does not execute AWS changes, trigger a release, or approve recovery or application deployment.</p>
            <p class="muted">Shared platform changes require a separate platform administrator and platform release.</p>
            <details class="evidence-detail"><summary>Maintenance digest &amp; verification</summary><code>{{ status.maintenance.digest }}</code><ol><li v-for="(step,i) in status.maintenance.verification" :key="i">{{ step }}</li></ol></details>
            <div v-if="status.canReviewMaintenance" class="button-row"><button type="button" class="lifecycle-button" :disabled="busy" @click="maintenance('approve')">Approve separate platform maintenance</button><button v-if="status.maintenance.approval" type="button" class="lifecycle-button" :disabled="busy" @click="maintenance('verify')">Verify platform prerequisites</button></div>
            <p v-else class="muted">An explicitly configured platform administrator must review this request.</p>
            <ul v-if="status.maintenance.remaining?.length"><li v-for="(item,i) in status.maintenance.remaining" :key="i">{{ item.message }}</li></ul>
          </div>
        </details>
      </section>
      <p v-if="status?.state === 'awaiting-review'" class="lifecycle-notice">Deployment approval is pending. Open the graph’s infrastructure review (cloud icon) to review the template and approve its exact digest.</p>
      <button v-if="canRetry && !recoveryControls" type="button" class="lifecycle-button" :disabled="busy" @click="reviewAgain">Prepare fresh deployment review</button>
      <details v-if="status?.state === 'succeeded'" class="lifecycle-section">
        <summary>Application runtime diagnostics<span class="summary-note">{{ status.runtimeReadiness?.state || 'Not verified' }}</span></summary>
        <div class="section-body">
          <p>Deployment completed. Runtime readiness: {{ status.runtimeReadiness?.state || 'Not verified' }}.</p>
          <label class="field-label">Function <select v-model="logicalId"><option value="">Select an owned Lambda</option><option v-for="r in functions" :key="r.logicalId" :value="r.logicalId">{{ r.logicalId }}</option></select></label>
          <p class="muted">Filter by one correlation ID or Lambda request ID, or leave both empty.</p>
          <div class="filter-fields"><label class="field-label">Correlation ID <input v-model="correlationId" maxlength="128" :disabled="!!requestId"/></label><label class="field-label">Lambda request ID <input v-model="requestId" maxlength="128" :disabled="!!correlationId"/></label></div>
          <div class="button-row"><button type="button" class="lifecycle-button" :disabled="busy || !logicalId" @click="logs(false)">Read last 15 minutes</button><button v-if="logPage?.nextCursor" type="button" class="lifecycle-button" :disabled="busy" @click="logs(true)">Next log page</button></div>
          <p v-if="logPage?.unavailable || logPage?.error" role="status">{{ logPage.reason || logPage.error?.message || 'Logs are unavailable.' }}</p>
          <p v-if="logPage?.truncated" class="muted">More log output exists. Continue with the next page or narrow the query.</p>
          <p v-if="logPage?.omitted" class="muted">{{ logPage.omitted }} payload or non-diagnostic records omitted.</p>
          <pre v-for="entry in logPage?.events || []" :key="entry.id">{{ entry.at }} {{ entry.requestId }}
{{ entry.message }}<template v-if="entry.error?.trace?.length">
{{ entry.error.trace.join('\n') }}</template></pre>
          <div v-for="check in status.readinessChecks || []" :key="check.id" class="readiness-check"><div class="button-row"><button type="button" class="lifecycle-button" :disabled="busy" @click="readiness(check.id)">Run {{ check.id }}</button><span>{{ status.runtimeReadiness?.checks?.[check.id]?.state || 'Not verified' }}</span></div><p class="muted">{{ check.description }}</p></div>
          <p v-if="!status.readinessChecks?.length" class="muted">No readiness checks were declared in this deployment. Add them through a graph proposal and a new deployment review.</p>
        </div>
      </details>
    </div>
    <footer v-if="error || (status && recoveryControls)" class="recovery-footer" data-testid="recovery-footer">
      <p v-if="error" role="alert" class="lifecycle-notice tone-error">{{ error }}</p>
      <template v-if="status && recoveryControls">
        <div v-if="status.recoveryPlan" class="digest-row"><span>Recovery digest</span><code>{{ status.recoveryPlan.digest }}</code></div>
        <p v-if="recoveryExpired" class="tone-error">This recovery review expired. Prepare a fresh plan before approving.</p>
        <p v-if="status.supersededBy" class="tone-warning">This operation was superseded. Open the current review to continue.</p>
        <label v-if="canApproveRecovery && !status.recoveryPlan.preservesData" class="checkbox-label tone-error"><input type="checkbox" v-model="confirmDataLoss"/><span>I approve the listed data deletions.</span></label>
        <div class="footer-bottom">
          <div class="approval-scope"><p v-if="status.recoveryApproval" class="tone-success">Recovery {{ status.recoveryApproval.mode === 'automatic' ? 'automatically approved' : 'approved' }} at {{ time(status.recoveryApproval.at) }}.</p><p>{{ status.recoveryPlan ? 'Approving recovery does not approve a new application template.' : 'Preparing a plan does not execute changes.' }}</p><small v-if="canApproveRecovery && status.expiresAt">Review expires {{ time(status.expiresAt) }}</small></div>
          <div class="button-row footer-actions">
            <button v-if="canPrepareRecovery" type="button" class="lifecycle-button" :class="{primary:!canApproveRecovery && !canRetry}" :disabled="busy" @click="prepareRecovery">Prepare recovery plan</button>
            <button v-if="canApproveRecovery" type="button" class="lifecycle-button primary" :disabled="busy || (!status.recoveryPlan.preservesData && !confirmDataLoss)" @click="approveRecovery">Approve this recovery</button>
            <button v-if="canRetry" type="button" class="lifecycle-button primary" :disabled="busy" @click="reviewAgain">Prepare fresh deployment review</button>
          </div>
        </div>
      </template>
    </footer>
  </div>
</template>
<script lang="ts">
import {useStore as orchestratorStore} from '@plastic-io/graph-editor-vue3-orchestrator';
export default {
  name:'deployment-lifecycle',props:{graphId:{type:String,required:true},nodeId:{type:String,required:true},status:{type:Object as any,default:null},recoveryControls:{type:Boolean,default:true},modal:{type:Boolean,default:false}},emits:['refresh'],
  data(){return {busy:false,error:'',currentInspection:null as any,allowDataLoss:false,confirmDataLoss:false,logicalId:'',requestId:'',correlationId:'',logPage:null as any,keys:{} as Record<string,string>,generation:0};},
  computed:{
    stateLabel():string{
      if(this.status?.supersededBy)return 'Superseded review';
      if(this.recoveryExpired)return 'Recovery review expired';
      const labels:any={'recovery-ready':'Awaiting recovery approval','recovery-blocked':'Recovery blocked','recovery-requested':'Recovery queued',recovering:'Recovery in progress',recovered:'Recovery complete',failed:this.status?.recoveryPlan?'Recovery failed':'Deployment failed','rollback-failed':'Rollback needs attention','rolled-back':'Deployment rolled back','awaiting-review':'Awaiting deployment approval',planning:'Preparing deployment review',succeeded:'Deployment complete','no-changes':'Up to date',stale:'New review required',expired:'Review expired',cancelled:'Review cancelled'};
      return labels[this.status?.state]||this.status?.state||'Inspect infrastructure';
    },
    stateTone():string{
      if(this.status?.supersededBy||this.recoveryExpired)return 'warning';
      if(['failed','rollback-failed','recovery-blocked'].includes(this.status?.state))return 'error';
      if(['recovered','succeeded','no-changes'].includes(this.status?.state))return 'success';
      if(['recovery-ready','awaiting-review','stale','expired','rolled-back'].includes(this.status?.state))return 'warning';
      return 'info';
    },
    includesStackDeletion():boolean{return this.status?.recoveryPlan?.actions?.some((action:any)=>action.kind==='delete-stack')||false;},
    inspection():any{return this.currentInspection||this.status?.inspection;},
    maintenanceConfiguration():any{return this.status?.maintenanceConfiguration || this.inspection?.maintenanceConfiguration || this.status?.maintenance?.administration;},
    functions():any[]{return (this.status?.resources||[]).filter((r:any)=>r.resourceType==='AWS::Lambda::Function');},
    canPrepareRecovery():boolean{return !this.status?.supersededBy && (this.status?.nextActions?.actions?.find((a:any)=>a.tool==='iac.recovery.plan')?.allowed ?? ['failed','rolled-back','rollback-failed','cancelled','expired','stale','recovered','recovery-blocked','recovery-ready','no-changes','succeeded'].includes(this.status?.state));},
    recoveryExpired():boolean{return this.status?.state==='recovery-ready' && this.status.expiresAt<Date.now();},
    canApproveRecovery():boolean{return this.status?.state==='recovery-ready' && !!this.status.recoveryPlan && !this.status.supersededBy && !this.recoveryExpired;},
    needsMaintenance():boolean{return (this.inspection?.blockers||[]).some((b:any)=>['platform-permission','platform-maintenance','capability'].includes(b.kind));},
    canRetry():boolean{return this.status?.nextActions?.actions?.some((a:any)=>a.tool==='iac.review'&&a.allowed);},
  },
  watch:{graphId(){this.reset();},nodeId(){this.reset();},'status.operationId'(){this.reset();}},
  methods:{
    actionLabel(kind:string):string{return ({'delete-stack':'Delete failed stack','import-retained':'Import retained resources','reconcile-guardrails':'Restore platform guardrails','continue-update-rollback':'Continue update rollback','rollback-stack':'Roll back stack','release-operation':'Release operation lock'} as any)[kind]||kind;},
    toneFor(value:any):string{const text=String(value||'');if(/FAILED|failed/.test(text))return 'error';if(/ROLLBACK|rollback|blocked/.test(text))return 'warning';if(/COMPLETE|Complete|succeeded|recovered/.test(text))return 'success';return 'neutral';},
    reset(){this.generation++;this.busy=false;this.error='';this.currentInspection=null;this.logPage=null;this.keys={};this.confirmDataLoss=false;this.logicalId='';this.requestId='';this.correlationId='';this.allowDataLoss=false;},
    time(value:any){return value?new Date(value).toLocaleString():'Not checked';},
    provider():any{const provider=orchestratorStore().syncProviders.find((p:any)=>typeof p.stackReview==='function');if(!provider?.inspectStack)throw new Error('Graph lifecycle support is unavailable. The platform and paired editor need the lifecycle release.');return provider;},
    key(action:string){const name=this.status?.operationId+':'+action;return this.keys[name]||(this.keys[name]=crypto.randomUUID());},
    async run(task:()=>Promise<void>){if(this.busy)return;this.busy=true;this.error='';const generation=this.generation;try{await task();if(generation===this.generation)this.$emit('refresh');}catch(e:any){if(generation===this.generation)this.error=e.message||'Lifecycle request failed.';}finally{if(generation===this.generation)this.busy=false;}},
    async inspect(){const generation=this.generation;await this.run(async()=>{const answer=await this.provider().inspectStack(this.graphId,this.nodeId,this.status?.operationId);if(generation===this.generation)this.currentInspection=answer;});},
    async prepareRecovery(){await this.run(async()=>{await this.provider().recoveryPlan(this.graphId,this.nodeId,{operationId:this.status.operationId,idempotencyKey:this.key('recover:'+this.allowDataLoss),allowDataLoss:this.allowDataLoss});});},
    async approveRecovery(){await this.run(async()=>{await this.provider().approveRecovery(this.graphId,this.nodeId,{operationId:this.status.operationId,recoveryDigest:this.status.recoveryPlan.digest,confirmDataLoss:this.confirmDataLoss});});},
    async maintenance(action:string){await this.run(async()=>{await this.provider().stackMaintenance(this.graphId,this.nodeId,{operationId:this.status.operationId,action,maintenanceDigest:this.status.maintenance?.digest});});},
    async reviewAgain(){await this.run(async()=>{await this.provider().planStack(this.graphId,this.nodeId,false,'apply',this.status.operationId);});},
    async logs(more:boolean){const generation=this.generation;await this.run(async()=>{const answer=await this.provider().runtimeLogs(this.graphId,this.nodeId,{operationId:this.status.operationId,logicalId:this.logicalId,correlationId:this.correlationId||undefined,requestId:this.requestId||undefined,cursor:more?this.logPage?.nextCursor:undefined});if(generation===this.generation)this.logPage=answer;});},
    async readiness(checkId:string){await this.run(async()=>{const result=await this.provider().stackReadiness(this.graphId,this.nodeId,{checkId,idempotencyKey:this.key('readiness:'+checkId)});if(result.state!=='running')delete this.keys[this.status.operationId+':readiness:'+checkId];});},
  },
};
</script>
<style scoped>
.lifecycle{--recovery-line:rgba(var(--v-theme-on-surface),.10);--recovery-muted:rgba(var(--v-theme-on-surface),.62);font-size:12px;line-height:1.45;color:rgb(var(--v-theme-on-surface));overflow-wrap:anywhere;min-width:0}
.lifecycle--modal{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;overflow:hidden}.lifecycle--modal .recovery-body{padding:12px 18px 16px;overflow-y:auto;overscroll-behavior:contain;min-height:0}.recovery-body{min-width:0}.lifecycle p{margin:6px 0}.muted,.summary-note{color:var(--recovery-muted);font-size:11px}.tone-error{color:rgb(var(--v-theme-error))}.tone-warning{color:rgb(var(--v-theme-warning))}.tone-success{color:rgb(var(--v-theme-success))}.tone-info{color:rgb(var(--v-theme-primary))}.tone-neutral{color:var(--recovery-muted)}
.recovery-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.recovery-state{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:12px}.state-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0}.lifecycle-button{font:inherit;font-size:11px;line-height:1.4;border:1px solid var(--recovery-line);padding:6px 10px;border-radius:5px;cursor:pointer;min-height:30px}.lifecycle-button:hover:not(:disabled){background:rgba(var(--v-theme-on-surface),.06)}.lifecycle-button.primary{background:rgb(var(--v-theme-primary));border-color:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary));font-weight:600}.lifecycle-button.primary:hover:not(:disabled){filter:brightness(1.1)}.lifecycle-button.subtle{border-color:transparent;color:var(--recovery-muted);padding:4px 6px}.lifecycle-button:disabled{opacity:.45;cursor:default}.lifecycle button:focus-visible,.lifecycle summary:focus-visible,.lifecycle input:focus-visible,.lifecycle select:focus-visible,.resource-scroll:focus-visible{outline:2px solid rgb(var(--v-theme-primary));outline-offset:2px}
.recovery-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:10px 12px;margin:0 0 12px;border:1px solid var(--recovery-line);border-radius:7px;background:rgba(var(--v-theme-on-surface),.025)}.recovery-summary>div+div{border-left:1px solid var(--recovery-line);padding-left:12px}.recovery-summary dt{font-size:10px;color:var(--recovery-muted);margin-bottom:3px}.recovery-summary dd{font-size:11px;font-weight:600;margin:0}.recovery-summary small{display:block;color:var(--recovery-muted);font-size:10px;margin-top:3px}
.lifecycle-notice{padding:9px 10px;border:1px solid var(--recovery-line);border-radius:6px;background:rgba(var(--v-theme-on-surface),.025);font-size:11px}.lifecycle-notice.tone-error{border-color:rgba(var(--v-theme-error),.22);background:rgba(var(--v-theme-error),.04)}.lifecycle-notice.tone-success{border-color:rgba(var(--v-theme-success),.20);background:rgba(var(--v-theme-success),.04)}.lifecycle-notice.tone-warning{border-color:rgba(var(--v-theme-warning),.22);background:rgba(var(--v-theme-warning),.04)}.section-heading{display:flex;align-items:center;gap:8px;margin:14px 0 5px}.section-heading h3{font-size:12px;font-weight:600;margin:0}.count,.target-label{font-size:10px;font-weight:400;color:var(--recovery-muted);border-radius:4px;background:rgba(var(--v-theme-on-surface),.055);padding:2px 6px;line-height:1.4}.retention-note{font-size:11px}.recovery-actions{list-style:none!important;padding:0!important;margin:10px 0 14px!important;border:1px solid var(--recovery-line);border-radius:7px;overflow:hidden}.recovery-actions>li{display:flex;gap:9px;padding:11px 12px;margin:0!important}.recovery-actions>li+li{border-top:1px solid var(--recovery-line)}.action-number{display:grid;place-items:center;width:21px;height:21px;flex:0 0 21px;border:1px solid var(--recovery-line);border-radius:50%;font-size:10px;color:var(--recovery-muted)}.action-content{flex:1;min-width:0}.action-heading{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-height:21px}.action-heading strong{font-size:12px;font-weight:600}.action-outcome{margin-left:auto;font-size:10px}.action-reason{font-size:11px;color:var(--recovery-muted);line-height:1.5}.stack-target{padding-top:3px;font-size:10px!important}.deletion-warning{font-size:11px;margin-top:5px}.resource-details{margin-top:6px;border-top:1px solid var(--recovery-line)}.resource-details>summary{padding:7px 0!important;font-size:11px}.resource-scroll{max-height:240px;overflow:auto;overscroll-behavior:contain}.lifecycle table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:11px}.lifecycle th{position:sticky;top:0;background:rgb(var(--v-theme-surface));text-align:left;color:var(--recovery-muted);font-size:10px;font-weight:500;padding:6px;border-bottom:1px solid var(--recovery-line)}.lifecycle th:first-child{width:68%}.lifecycle td{vertical-align:top;padding:7px 6px;border-bottom:1px solid var(--recovery-line);font-size:10px}.lifecycle td strong{font-weight:500}.lifecycle td code{color:var(--recovery-muted);margin-top:2px;font-size:10px}
.lifecycle-section{border-top:1px solid var(--recovery-line)}.lifecycle summary{display:flex;align-items:center;gap:7px;list-style:none;cursor:pointer;font-size:11px;font-weight:500;padding:9px 0;box-sizing:border-box}.lifecycle summary::-webkit-details-marker{display:none}.lifecycle summary::before{content:'';width:5px;height:5px;border-right:1.5px solid currentColor;border-top:1.5px solid currentColor;transform:rotate(45deg);color:var(--recovery-muted);margin:0 3px 0 1px;flex:0 0 5px}.lifecycle details[open]>summary::before{transform:rotate(135deg)}.lifecycle summary:hover{color:rgb(var(--v-theme-primary))}.summary-note{margin-left:auto;text-align:right;font-size:10px;font-weight:400}.section-body{padding:0 0 10px 13px;font-size:11px}.section-body>p:first-child{margin-top:0}.role-list{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}.role-list span{font-size:10px;border:1px solid var(--recovery-line);border-radius:4px;padding:3px 6px}.lifecycle ul,.lifecycle ol{padding-left:18px;margin:6px 0}.lifecycle li{margin:5px 0}.blocker-list{list-style:none;padding:0!important}.blocker-list>li{padding:7px 9px;border-left:2px solid rgba(var(--v-theme-warning),.5);background:rgba(var(--v-theme-warning),.035);font-size:11px}.blocker-list strong{font-weight:500}.blocker-list code{color:var(--recovery-muted);margin-top:3px}.evidence-detail{border-top:1px solid var(--recovery-line);margin-top:8px}.review-metadata{display:grid;grid-template-columns:105px minmax(0,1fr);gap:5px 10px;font-size:10px;margin:10px 0}.review-metadata dt{color:var(--recovery-muted)}.review-metadata dd{margin:0;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.lifecycle code{display:block;font-size:10px;overflow-wrap:anywhere}.lifecycle code.inline-code{display:inline}.lifecycle pre{white-space:pre-wrap;max-height:220px;overflow:auto;background:rgba(var(--v-theme-on-surface),.035);padding:8px;border:1px solid var(--recovery-line);border-radius:5px;font-size:10px;line-height:1.5;margin:6px 0}.checkbox-label{display:flex;align-items:flex-start;gap:8px;font-size:11px;cursor:pointer}.checkbox-label input{flex-shrink:0;margin-top:2px;accent-color:rgb(var(--v-theme-primary))}.field-label{display:flex;flex-direction:column;gap:4px;font-size:10px;color:var(--recovery-muted)}.field-label input,.field-label select{border:1px solid var(--recovery-line);border-radius:4px;color:rgb(var(--v-theme-on-surface));background:rgb(var(--v-theme-surface));font:inherit;font-size:11px;padding:6px;min-width:0;max-width:100%}.field-label input:disabled{opacity:.45}.filter-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0}.button-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.readiness-check{border-top:1px solid var(--recovery-line);padding-top:8px;margin-top:10px}.maintenance-section{border-top:1px solid var(--recovery-line);padding-bottom:10px}.maintenance-section>button{margin:6px 0}
.recovery-footer{flex:0 0 auto;border-top:1px solid var(--recovery-line);padding:12px 0 0;margin-top:8px;background:rgb(var(--v-theme-surface));font-size:11px}.lifecycle--modal .recovery-footer{padding:12px 18px 14px;margin-top:0}.digest-row{display:flex;align-items:baseline;gap:10px;margin-bottom:10px;min-width:0}.digest-row>span{color:var(--recovery-muted);font-size:10px;white-space:nowrap}.digest-row>code{font-size:10px;min-width:0}.footer-bottom{display:flex;gap:16px;align-items:center;justify-content:space-between}.approval-scope{min-width:0;max-width:310px;color:var(--recovery-muted);font-size:10px}.approval-scope p{margin:0}.approval-scope small{font-size:10px;display:block;margin-top:3px}.footer-actions{justify-content:flex-end;flex-shrink:0}.recovery-footer>.checkbox-label{margin-bottom:10px}
@media(max-width:720px){.footer-bottom{align-items:stretch;flex-direction:column;gap:10px}.approval-scope{max-width:none}.footer-actions{justify-content:flex-start}.recovery-summary{gap:8px;padding:9px}.recovery-summary>div+div{padding-left:8px}.summary-note{max-width:48%}}@media(max-width:480px){.lifecycle--modal .recovery-body{padding:10px 12px}.lifecycle--modal .recovery-footer{padding:10px 12px}.recovery-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.recovery-summary>div:last-child{grid-column:1/-1;border-left:0;border-top:1px solid var(--recovery-line);padding:7px 0 0}.digest-row{display:block}.digest-row code{margin-top:3px}.footer-actions{gap:5px}.lifecycle-button{padding:6px 8px}.filter-fields{grid-template-columns:1fr}}
</style>
