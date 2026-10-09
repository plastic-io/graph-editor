<template>
  <div class="lifecycle" data-testid="deployment-lifecycle" @mousedown.stop @mouseup.stop @mousemove.stop @keydown.stop @keyup.stop @wheel.stop>
    <p v-if="error" role="alert" class="failure">{{ error }}</p>
    <button type="button" :disabled="busy" @click="inspect">Check current readiness</button>
    <details v-if="inspection" open>
      <summary>Current conditions · {{ time(inspection.checkedAt) }}</summary>
      <p>Application: {{ inspection.application.status }} · Guardrails: {{ inspection.guardrail.status }}</p>
      <p>Ownership: application {{ inspection.application.ownership }}, guardrails {{ inspection.guardrail.ownership }}</p>
      <p>Worker role assumption: {{ inspection.assumption?.result }}. Policy analysis does not prove deployment will succeed.</p>
      <p v-if="inspection.recoveryReadiness?.state === 'review-available'" data-testid="recovery-available">Graph-owned infrastructure recovery is available for human review. Missing deployment roles are restored using platform authority; they do not need to exist before recovery approval.</p>
      <ul v-if="inspection.roles?.length"><li v-for="role in inspection.roles" :key="role.logicalId">{{ role.logicalId }}: {{ role.exists === false ? 'Absent' : role.exists === true ? 'Present' : 'Unknown — verification required' }}</li></ul>
      <details v-if="inspection.historicalFailure"><summary>Historical failure · {{ inspection.historicalFailureOperationId }}</summary><p>This is previous failure evidence, not a current permission check.</p><pre>{{ typeof inspection.historicalFailure === 'string' ? inspection.historicalFailure : inspection.historicalFailure.message }}</pre></details>
      <p v-if="inspection.activeOperation">Active operation: {{ inspection.activeOperation.operationId }} · {{ inspection.activeOperation.state }}</p>
      <ul><li v-for="(item,i) in inspection.blockers" :key="i"><strong>{{ item.code }}</strong>: {{ item.message }} <code>{{ item.action }} {{ item.resource }}</code></li></ul>
      <details><summary>Ownership, surviving resources and permission evidence</summary><pre>{{ JSON.stringify(inspection, null, 2) }}</pre></details>
    </details>
    <template v-if="status">
      <p v-if="status.state === 'recovered'">Recovery completed. The next application deployment needs a fresh review and a separate human approval.</p>
      <template v-if="canPrepareRecovery">
        <button type="button" :disabled="busy" @click="prepareRecovery">Prepare recovery plan</button>
        <details><summary>Data-loss exception</summary><label><input type="checkbox" v-model="allowDataLoss"/> Include data deletion in the plan if safe recovery cannot preserve it. Execution still requires explicit approval of the listed deletions.</label></details>
      </template>
      <details v-if="status.recoveryPlan" open data-testid="recovery-plan">
        <summary>Recovery review · {{ status.state }}</summary>
        <p>{{ status.recoveryPlan.preservesData ? 'Preserves retained resources and application data.' : 'This plan includes data loss.' }}</p>
        <p>Source operation: {{ status.recoveryPlan.sourceOperationId }}</p>
        <ol><li v-for="(action,i) in status.recoveryPlan.actions" :key="i"><strong>{{ action.kind }}</strong> · {{ action.target }}<div>{{ action.reason }}</div>
          <div v-if="action.dataLoss?.length" class="failure">Data deletion: {{ action.dataLoss.join(', ') }}</div>
          <ul v-if="action.resources?.length"><li v-for="resource in action.resources" :key="resource.logicalId">{{ resource.logicalId }} · {{ resource.physicalId }} · {{ resource.outcome || 'Import and retain' }}</li></ul>
          <p v-if="status.recoveryOutcomes?.[i]">{{ status.recoveryOutcomes[i].status || (status.recoveryOutcomes[i].done ? 'Complete' : 'In progress') }}</p>
        </li></ol>
        <ul><li v-for="(item,i) in status.recoveryPlan.prerequisites" :key="i" class="failure">{{ item.code }}: {{ item.message }}</li></ul>
        <details><summary>Approved platform guardrail definition</summary><pre>{{ JSON.stringify(status.inspection?.approvedGuardrailTemplate, null, 2) }}</pre></details>
        <p v-if="recoveryExpired" class="failure">This recovery review expired. Prepare a fresh plan before approving.</p>
        <p>Recovery digest <code>{{ status.recoveryPlan.digest }}</code></p>
        <p>Approving recovery does not approve a new application template.</p>
        <p>This graph recovery needs a human with infrastructure approval authority. Platform-maintenance administrator membership is not required.</p>
        <label v-if="canApproveRecovery && !status.recoveryPlan.preservesData"><input type="checkbox" v-model="confirmDataLoss"/> I approve the listed data deletions.</label>
        <button v-if="canApproveRecovery" type="button" :disabled="busy || (!status.recoveryPlan.preservesData && !confirmDataLoss)" @click="approveRecovery">Approve this recovery</button>
        <p v-if="status.recoveryApproval">Recovery approved at {{ time(status.recoveryApproval.at) }}. {{ status.state }}</p>
      </details>
      <button v-if="needsMaintenance" type="button" :disabled="busy" @click="maintenance('request')">Request platform maintenance review</button>
      <p v-if="(needsMaintenance || status.maintenance) && maintenanceConfiguration?.blocker" class="failure" data-testid="maintenance-configuration">{{ maintenanceConfiguration.blocker.message }}</p>
      <details v-if="status.maintenance" open data-testid="maintenance-request">
        <summary>Platform maintenance · {{ status.maintenance.state }}</summary>
        <ul><li v-for="(requirement,i) in status.maintenance.requirements" :key="i">{{ requirement.component }} · {{ requirement.message }}<code>{{ requirement.action }} {{ requirement.resource }}</code></li></ul>
        <p>This request only records and verifies a platform maintenance review. Requesting or approving it does not execute AWS changes, trigger a release, or approve recovery or application deployment.</p>
        <p>Shared platform changes require a separate platform administrator and platform release.</p>
        <code>{{ status.maintenance.digest }}</code>
        <ol><li v-for="(step,i) in status.maintenance.verification" :key="i">{{ step }}</li></ol>
        <template v-if="status.canReviewMaintenance">
          <button type="button" :disabled="busy" @click="maintenance('approve')">Approve separate platform maintenance</button>
          <button v-if="status.maintenance.approval" type="button" :disabled="busy" @click="maintenance('verify')">Verify platform prerequisites</button>
        </template>
        <p v-else>An explicitly configured platform administrator must review this request.</p>
        <ul><li v-for="(item,i) in status.maintenance.remaining" :key="i">{{ item.message }}</li></ul>
      </details>
      <button v-if="canRetry" type="button" :disabled="busy" @click="reviewAgain">Prepare fresh deployment review</button>
      <p v-if="status.state === 'awaiting-review'">Deployment approval is pending. Open the graph’s infrastructure review (cloud icon) to review the template and approve its exact digest.</p>
      <details v-if="status.state === 'succeeded'">
        <summary>Application runtime diagnostics</summary>
        <p>Deployment completed. Runtime readiness: {{ status.runtimeReadiness?.state || 'Not verified' }}.</p>
        <label>Function <select v-model="logicalId"><option value="">Select an owned Lambda</option><option v-for="r in functions" :key="r.logicalId" :value="r.logicalId">{{ r.logicalId }}</option></select></label>
        <p>Filter by one correlation ID or Lambda request ID, or leave both empty.</p>
        <label>Correlation ID <input v-model="correlationId" maxlength="128" :disabled="!!requestId"/></label>
        <label>Lambda request ID <input v-model="requestId" maxlength="128" :disabled="!!correlationId"/></label>
        <button type="button" :disabled="busy || !logicalId" @click="logs(false)">Read last 15 minutes</button>
        <button v-if="logPage?.nextCursor" type="button" :disabled="busy" @click="logs(true)">Next log page</button>
        <p v-if="logPage?.unavailable || logPage?.error" role="status">{{ logPage.reason || logPage.error?.message || 'Logs are unavailable.' }}</p>
        <p v-if="logPage?.truncated">More log output exists. Continue with the next page or narrow the query.</p>
        <p v-if="logPage?.omitted">{{ logPage.omitted }} payload or non-diagnostic records omitted.</p>
        <pre v-for="entry in logPage?.events || []" :key="entry.id">{{ entry.at }} {{ entry.requestId }}
{{ entry.message }}<template v-if="entry.error?.trace?.length">
{{ entry.error.trace.join('\n') }}</template></pre>
        <div v-for="check in status.readinessChecks || []" :key="check.id">
          <button type="button" :disabled="busy" @click="readiness(check.id)">Run {{ check.id }}</button>
          <span>{{ status.runtimeReadiness?.checks?.[check.id]?.state || 'Not verified' }}</span>
          <p>{{ check.description }}</p>
        </div>
        <p v-if="!status.readinessChecks?.length">No readiness checks were declared in this deployment. Add them through a graph proposal and a new deployment review.</p>
      </details>
    </template>
  </div>
</template>
<script lang="ts">
import {useStore as orchestratorStore} from '@plastic-io/graph-editor-vue3-orchestrator';
export default {
  name:'deployment-lifecycle',props:{graphId:{type:String,required:true},nodeId:{type:String,required:true},status:{type:Object as any,default:null}},emits:['refresh'],
  data(){return {busy:false,error:'',currentInspection:null as any,allowDataLoss:false,confirmDataLoss:false,logicalId:'',requestId:'',correlationId:'',logPage:null as any,keys:{} as Record<string,string>,generation:0};},
  computed:{
    inspection():any{return this.currentInspection||this.status?.inspection;},
    maintenanceConfiguration():any{return this.status?.maintenanceConfiguration || this.inspection?.maintenanceConfiguration || this.status?.maintenance?.administration;},
    functions():any[]{return (this.status?.resources||[]).filter((r:any)=>r.resourceType==='AWS::Lambda::Function');},
    canPrepareRecovery():boolean{return !this.status?.supersededBy && (this.status?.nextActions?.actions?.find((a:any)=>a.tool==='iac.recovery.plan')?.allowed ?? ['failed','rolled-back','rollback-failed','cancelled','expired','stale','recovered','recovery-blocked','recovery-ready','no-changes','succeeded'].includes(this.status?.state));},
    recoveryExpired():boolean{return this.status?.state==='recovery-ready' && this.status.expiresAt<Date.now();},
    canApproveRecovery():boolean{return this.status?.state==='recovery-ready' && !this.status.supersededBy && !this.recoveryExpired;},
    needsMaintenance():boolean{return (this.inspection?.blockers||[]).some((b:any)=>['platform-permission','platform-maintenance','capability'].includes(b.kind));},
    canRetry():boolean{return this.status?.nextActions?.actions?.some((a:any)=>a.tool==='iac.review'&&a.allowed);},
  },
  watch:{graphId(){this.reset();},nodeId(){this.reset();},'status.operationId'(){this.reset();}},
  methods:{
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
.lifecycle{border-top:1px solid #8886;margin-top:10px;padding-top:8px;overflow-wrap:anywhere}.lifecycle button,.lifecycle input,.lifecycle select{border:1px solid #8888;border-radius:4px;padding:4px;margin:4px;max-width:100%}.lifecycle label{display:block}.lifecycle summary{cursor:pointer;padding:7px 0}.lifecycle pre{white-space:pre-wrap;max-height:220px;overflow:auto;background:#8881;padding:6px}.lifecycle code{display:block;font-size:11px}.lifecycle ul,.lifecycle ol{padding-left:18px}.lifecycle li{margin:6px 0}.failure{color:rgb(var(--v-theme-error))}
</style>
