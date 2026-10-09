<template>
  <section class="deployment-progress" data-testid="deployment-progress" :aria-busy="busy" @pointerdown.stop @mousedown.stop @mouseup.stop @click.stop @keydown.stop @keyup.stop @wheel.stop>
    <header class="cf-header">
      <span class="cf-provider" aria-hidden="true"><v-icon icon="mdi-cloud-braces" size="21"/></span>
      <div class="cf-heading"><h3>CloudFormation</h3><p :title="target.name">{{ target.name || 'Infrastructure stack' }}</p></div>
      <button class="cf-icon-button" type="button" :disabled="busy" aria-label="Refresh deployment" title="Refresh deployment" @click="refresh"><v-icon icon="mdi-refresh" size="18" :class="{'cf-spinning':busy}"/></button>
    </header>

    <div class="cf-status-line">
      <span class="cf-status" :class="'tone-'+statusTone"><span class="cf-dot"/><strong>{{ phaseLabel }}</strong></span>
      <span class="cf-target" :title="[target.region,target.account].filter(Boolean).join(' · ')">{{ [target.region,target.account].filter(Boolean).join(' · ') }}</span>
    </div>
    <p v-if="error" class="cf-fetch-error" role="alert">{{ error }}</p>
    <div v-if="!status && !busy" class="cf-empty"><v-icon icon="mdi-cloud-outline" size="26"/><p>No deployment review yet.</p><small>Accept graph changes, then create an infrastructure review.</small></div>

    <template v-if="status">
      <dl class="cf-milestones" aria-label="Deployment milestones">
        <div><dt>Graph revision</dt><dd :title="status.revisionId || 'Live graph'">{{ status.revisionId ? shortId(status.revisionId) : 'Live graph' }}</dd></div>
        <div><dt>{{ isRecovery ? 'Recovery' : 'Deployment' }} approval</dt><dd :class="{'tone-warning':!currentApproval}">{{ approvalLabel }}</dd></div>
        <div><dt>Execution</dt><dd :class="'tone-'+statusTone">{{ executionLabel }}</dd></div>
      </dl>

      <div v-if="noticeMessage || recoveryNeeded || status.state === 'awaiting-review'" class="cf-notice" :class="{'is-failure':failed}" :role="failed ? 'alert' : 'status'">
        <v-icon :icon="failed ? 'mdi-alert-circle-outline' : recoveryNeeded ? 'mdi-lifebuoy' : 'mdi-information-outline'" size="17"/>
        <div>
          <p v-if="noticeMessage" class="cf-notice-message" :class="{expanded:expandNotice}">{{ noticeMessage }}</p>
          <button v-if="noticeMessage.length > 180" class="cf-text-button" type="button" :aria-expanded="expandNotice" @click="expandNotice=!expandNotice">{{ expandNotice ? 'Show less' : 'Show full message' }}</button>
          <p v-if="recoveryNeeded" class="cf-next-step">Review recovery in the lower system bar.</p>
          <p v-else-if="status.state === 'awaiting-review'" class="cf-next-step">Review and approve this deployment from the cloud icon in the system bar.</p>
        </div>
      </div>

      <div class="cf-sections">
        <details class="cf-section" data-testid="cf-resources">
          <summary><v-icon class="cf-chevron" icon="mdi-chevron-right" size="16"/><span>Resources</span><span v-if="failedResources" class="cf-count tone-error">{{ failedResources }} failed</span><span class="cf-count">{{ resources.length }}</span></summary>
          <div class="cf-section-body">
            <table v-if="resources.length"><thead><tr><th>Resource</th><th>Status</th><th>Updated</th></tr></thead><tbody><tr v-for="resource in resources" :key="resource.stackName+'/'+resource.logicalId">
              <td><strong>{{ resource.logicalId }}</strong><small>{{ resource.resourceType }}</small><details v-if="resource.physicalId || resource.stackName" class="cf-resource-id"><summary>Identifier</summary><code>{{ resource.physicalId || resource.stackName }}</code></details></td>
              <td><span class="cf-resource-state" :class="'tone-'+toneFor(resource.status)">{{ resource.status }}</span><p v-if="resource.reason" :class="{'tone-error':/FAILED/.test(resource.status)}">{{ resource.reason }}</p></td>
              <td class="cf-time" :title="time(resource.at)">{{ shortTime(resource.at) }}</td>
            </tr></tbody></table>
            <p v-else class="cf-muted">No resource events have been reported.</p>
          </div>
        </details>
        <details class="cf-section" data-testid="cf-activity">
          <summary><v-icon class="cf-chevron" icon="mdi-chevron-right" size="16"/><span>Activity &amp; history</span><span class="cf-count">{{ events.length }}</span></summary>
          <div class="cf-section-body">
            <label class="cf-history-picker">Operation <select v-model="selectedOperation" @change="changeOperation"><option value="">Current operation</option><option v-for="op in operations" :key="op.operationId" :value="op.operationId">{{ time(op.createdAt) }} · {{ op.state }} · {{ shortId(op.operationId) }}</option></select></label>
            <button v-if="historyCursor" class="cf-button" type="button" @click="loadHistory(true)">More operations</button>
            <ol class="events"><li v-for="event in recentEvents" :key="event.id"><div class="cf-event-heading"><span :class="'tone-'+toneFor(event.status || event.state)">{{ event.logicalId || event.phase || event.source }}<small v-if="event.status || event.state">{{ event.status || event.state }}</small></span><time :title="time(event.at)">{{ shortTime(event.at) }}</time></div><p>{{ event.reason || event.message || event.error?.message }}</p><code v-if="event.error">{{ event.error.code }}</code></li></ol>
            <p v-if="!events.length" class="cf-muted">No activity has been recorded.</p>
            <button v-if="hasMore" class="cf-button" type="button" :disabled="busy" @click="loadEvents()">Load more diagnostic events</button>
            <p v-if="clipped" class="cf-muted">Showing the latest 1,000 loaded events. Earlier records remain available through MCP.</p>
          </div>
        </details>
        <details class="cf-section" data-testid="cf-diagnostics">
          <summary><v-icon class="cf-chevron" icon="mdi-chevron-right" size="16"/><span>Diagnostic logs</span><v-icon v-if="status.progress?.collectionWarning" icon="mdi-alert-outline" size="14" class="tone-warning" title="Some diagnostics are unavailable"/><span class="cf-count">{{ logs.length }}</span></summary>
          <div class="cf-section-body"><p class="cf-muted">Redacted platform logs. Application payloads are excluded.</p><p v-if="status.progress?.collectionWarning" class="tone-warning">{{ status.progress.collectionWarning.reason }}</p><pre v-for="entry in logs" :key="entry.id"><span class="cf-log-heading">{{ time(entry.at) }} · {{ entry.source }} · {{ entry.status }}</span>
{{ entry.message || entry.reason || entry.error?.message }}<template v-if="entry.error?.trace?.length">
{{ entry.error.trace.join('\n') }}</template></pre><p v-if="!logs.length" class="cf-muted">No diagnostic log entries have been collected.</p></div>
        </details>
        <details class="cf-section" data-testid="cf-readiness">
          <summary><v-icon class="cf-chevron" icon="mdi-chevron-right" size="16"/><span>Readiness &amp; recovery</span><span v-if="recoveryNeeded" class="cf-summary-note tone-warning">Review in system bar</span><span v-else-if="status.runtimeReadiness?.state" class="cf-summary-note">{{ status.runtimeReadiness.state }}</span></summary>
          <div class="cf-section-body"><deployment-lifecycle :graph-id="graphId" :node-id="nodeId" :status="status" :recovery-controls="recoveryControls" @refresh="refresh"/></div>
        </details>
        <details class="cf-section cf-operation" data-testid="cf-operation">
          <summary><v-icon class="cf-chevron" icon="mdi-chevron-right" size="14"/><span :title="status.operationId">{{ selectedOperation ? 'History' : 'Operation' }} · {{ shortId(status.operationId) }}</span><time :title="time(status.updatedAt)">Updated {{ shortTime(status.updatedAt) }}</time></summary>
          <div class="cf-section-body"><dl class="cf-operation-data"><dt>Operation</dt><dd>{{ status.operationId }}</dd><dt>Graph revision</dt><dd>{{ status.revisionId || 'Live graph' }}</dd><dt>State</dt><dd>{{ status.state }}</dd><dt>Deployment approval</dt><dd>{{ status.approval ? (status.approval.mode === 'automatic' ? 'Automatically approved for this review digest' : 'Recorded for this review digest') : 'Not recorded' }}</dd><template v-if="status.recoveryApproval"><dt>Recovery approval</dt><dd>{{ status.recoveryApproval.mode === 'automatic' ? 'Automatic' : 'Manual' }} · {{ time(status.recoveryApproval.at) }}</dd></template><template v-if="status.reviewDigest"><dt>Review digest</dt><dd>{{ status.reviewDigest }}</dd></template><template v-if="status.error"><dt>Error</dt><dd>{{ status.error.code }}: {{ status.error.message }}</dd></template><template v-if="status.recovery"><dt>Recovery guidance</dt><dd>{{ status.recovery.message }}</dd></template></dl><p class="cf-muted">An accepted graph is not deployment approval. Approval applies only to the exact reviewed digest.</p></div>
        </details>
      </div>
    </template>
  </section>
</template>
<script lang="ts">
import DeploymentLifecycle from './DeploymentLifecycle.vue';
import {useStore as orchestratorStore} from '@plastic-io/graph-editor-vue3-orchestrator';
export default {
  name:'deployment-progress',components:{DeploymentLifecycle},props:{graphId:{type:String,required:true},nodeId:{type:String,required:true},stack:{type:Object as any,default:null},recoveryControls:{type:Boolean,default:true}},emits:['status'],
  data(){return {status:null as any,events:[] as any[],operations:[] as any[],cursor:'',historyCursor:'',hasMore:false,selectedOperation:'',error:'',busy:false,timer:null as any,detach:null as any,generation:0,clipped:false,expandNotice:false};},
  computed:{
    latest():any{return this.status?.progress?.latest;},
    target():any{return this.status?.stack||this.stack||{};},
    resources():any[]{
      const rows=new Map<string,any>();
      for(const event of [...(this.status?.progress?.resources||[]),...this.events])if(event.logicalId){const key=event.stackName+'/'+event.logicalId,prior=rows.get(key);if(!prior||event.at>=prior.at)rows.set(key,event);}
      return [...rows.values()];
    },
    recentEvents():any[]{return [...this.events].reverse();},
    failedResources():number{return this.resources.filter((r:any)=>/FAILED/.test(r.status)).length;},
    logs():any[]{return this.events.filter((e:any)=>['cloudwatch','diagnostics'].includes(e.source)||e.error);},
    failed():boolean{return ['failed','rollback-failed','rolled-back'].includes(this.status?.state);},
    isRecovery():boolean{return this.status?.action==='recover'||['recovery-ready','recovery-blocked','recovery-requested','recovering','recovered'].includes(this.status?.state);},
    currentApproval():any{return this.isRecovery?this.status?.recoveryApproval:this.status?.approval;},
    approvalLabel():string{return this.currentApproval?(this.currentApproval.mode==='automatic'?'Auto-approved':'Approved'):'Pending';},
    recoveryNeeded():boolean{return !['recovered','succeeded','no-changes'].includes(this.status?.state)&&!!(this.status?.manualRecoveryRequired||this.status?.recoveryPlan);},
    noticeMessage():string{const active=this.failed||['planning','applying','recovering'].includes(this.status?.state);return this.status?.error?.message||this.status?.reason||(active?(this.resources.find((r:any)=>/FAILED/.test(r.status)&&r.reason)?.reason||this.latest?.reason||this.status?.recovery?.message):'')||'';},
    statusTone():string{if(this.failed)return 'error';if(['awaiting-review','recovery-ready','recovery-blocked'].includes(this.status?.state))return 'warning';if(['succeeded','recovered','no-changes'].includes(this.status?.state))return 'success';return this.status?'info':'neutral';},
    executionLabel():string{const labels:any={planning:'Preparing','awaiting-review':'Not started','recovery-ready':'Not started','recovery-blocked':'Blocked','apply-requested':'Queued','recovery-requested':'Queued',applying:'In progress',recovering:'In progress',succeeded:'Complete',recovered:'Recovered',failed:'Failed','rollback-failed':'Rollback failed','rolled-back':'Rolled back','no-changes':'No changes',cancelled:'Cancelled',expired:'Not started',stale:'Not started'};return labels[this.status?.state]||this.status?.state||'Not started';},
    phaseLabel():string{
      // A historical guardrail event must not obscure a current approval gate.
      const states:any={'awaiting-review':'Awaiting deployment approval','recovery-ready':'Awaiting recovery approval','recovery-blocked':'Recovery blocked','recovered':'Recovery complete',succeeded:'Deployment complete','no-changes':'Up to date',cancelled:'Review cancelled',expired:'Review expired',stale:'New review required',destroyed:'Stack deleted'};
      if(states[this.status?.state])return states[this.status.state];
      if(this.failed)return this.status?.state==='rollback-failed'?'Rollback needs attention':this.status?.state==='rolled-back'?'Deployment rolled back':this.isRecovery?'Recovery failed':'Deployment failed';
      const phases:any={guardrails:'Preparing guardrails',planning:'Planning','awaiting-approval':'Awaiting deployment approval',deploying:'Deploying','rolling-back':'Rolling back',cleanup:'Cleanup',recovering:'Recovering','awaiting-recovery-approval':'Awaiting recovery approval',readiness:'Checking readiness',maintenance:'Platform maintenance',runtime:'Runtime diagnostics'};
      return phases[this.status?.progress?.phase||this.latest?.phase]||({planning:'Planning',recovering:'Recovering',applying:'Deploying','apply-requested':'Deployment queued','recovery-requested':'Recovery queued'} as any)[this.status?.state]||this.status?.state||(this.busy?'Loading status':'Not deployed');
    },
  },
  watch:{graphId(){this.start();},nodeId(){this.start();}},
  mounted(){this.start();},beforeUnmount(){this.stop();},
  methods:{
    provider():any{return (orchestratorStore().syncProviders||[]).find((p:any)=>typeof p.stackReview==='function');},
    time(value:any){return value?new Date(value).toLocaleString():'—';},
    shortTime(value:any){return value?new Date(value).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}):'—';},
    shortId(value:any){const text=String(value||'');return text.length>20?text.slice(0,10)+'…'+text.slice(-6):text;},
    toneFor(value:any){const text=String(value||'');if(/FAILED|failed/.test(text))return 'error';if(/ROLLBACK|rollback|SKIPPED|awaiting|blocked/.test(text))return 'warning';if(/COMPLETE|succeeded|recovered/.test(text))return 'success';if(/PROGRESS|planning|applying|recovering/.test(text))return 'info';return 'neutral';},
    stop(){clearTimeout(this.timer);this.detach?.();this.detach=null;this.generation++;},
    start(){this.stop();this.busy=false;this.hasMore=false;this.error='';this.status=null;this.events=[];this.cursor='';this.selectedOperation='';this.operations=[];this.historyCursor='';this.clipped=false;
      const bus:any=orchestratorStore().dataProviders.graph,channel='graph-notify-'+this.graphId;
      if(bus?.subscribe){const listener=(wrapped:any)=>this.receive(wrapped?.response||wrapped);bus.subscribe(channel,listener);const off=bus.onOpen?.(()=>this.refresh());this.detach=()=>{bus.unsubscribe(channel,listener);off?.();};}
      this.refresh();this.loadHistory();
    },
    merge(events:any[]){const byId=new Map(this.events.map((e:any)=>[e.id,e]));for(const event of events)if(event.graphId===this.graphId&&event.nodeId===this.nodeId&&event.operationId===this.status?.operationId)byId.set(event.id,event);const rows=[...byId.values()].sort((a:any,b:any)=>a.sequence-b.sequence);this.clipped=this.clipped||rows.length>1000;this.events=rows.slice(-1000);},
    receive(event:any){if(event?.eventType!=='deployment.progress'||event.provenance!=='server'||event.graphId!==this.graphId||event.nodeId!==this.nodeId)return;
      if(this.selectedOperation&&event.operationId!==this.selectedOperation)return;
      if(event.operationId===this.status?.operationId)this.merge([event]);
      // Socket events are the same durable records MCP watches. Snapshot/paged reads recover missed frames.
      clearTimeout(this.timer);this.timer=setTimeout(()=>this.refresh(),300);
    },
    async refresh(){if(this.busy)return;const generation=this.generation,provider=this.provider();if(!provider)return;this.busy=true;
      try{const answer=await provider.stackReview(this.graphId,this.nodeId,this.selectedOperation||undefined);if(generation!==this.generation)return;const status=answer.status;
        if(this.status?.operationId!==status?.operationId){this.events=[];this.cursor='';this.clipped=false;this.loadHistory();}
        if(this.status?.operationId!==status?.operationId)this.expandNotice=false;this.status=status;this.error='';if(!this.selectedOperation&&status)this.$emit('status',status);await this.loadEvents(generation);
      }catch(e:any){if(generation===this.generation)this.error=e.message||'Cannot refresh deployment diagnostics.';}
      finally{if(generation===this.generation){this.busy=false;clearTimeout(this.timer);this.timer=setTimeout(()=>this.refresh(),5000);}}
    },
    async loadEvents(expectedGeneration?:number){const generation=expectedGeneration??this.generation;const provider=this.provider(),operationId=this.status?.operationId;if(!operationId||!provider?.stackEvents)return;
      try{const page=await provider.stackEvents(this.graphId,this.nodeId,{operationId,cursor:this.cursor||undefined,limit:50});if(generation!==this.generation||operationId!==this.status?.operationId)return;this.merge(page.events||[]);this.cursor=page.nextCursor;this.hasMore=page.hasMore;
      }catch(e:any){if(generation===this.generation)this.error=e.message||'Cannot read diagnostic history.';}
    },
    async loadHistory(more=false){const provider=this.provider(),generation=this.generation;if(!provider?.stackOperations)return;try{const answer=await provider.stackOperations(this.graphId,this.nodeId,more?this.historyCursor:undefined);if(generation!==this.generation)return;this.operations=more?[...this.operations,...answer.operations]:answer.operations;this.historyCursor=answer.nextCursor||'';}catch(e:any){if(generation===this.generation)this.error=e.message;}},
    changeOperation(){this.generation++;this.busy=false;this.status=null;this.events=[];this.cursor='';this.clipped=false;this.refresh();},
  },
};
</script>
<style scoped>
.deployment-progress{--cf-line:rgba(var(--v-theme-on-surface),.10);--cf-muted:rgba(var(--v-theme-on-surface),.62);background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));border:1px solid var(--cf-line);border-radius:8px;min-width:0;width:100%;box-sizing:border-box;font-size:12px;line-height:1.45;overflow-wrap:anywhere}
.cf-header{display:flex;align-items:center;gap:10px;padding:12px 14px 10px}.cf-provider{display:grid;place-items:center;flex:0 0 34px;height:34px;color:rgb(var(--v-theme-warning));background:rgba(var(--v-theme-warning),.10);border-radius:8px}.cf-heading{flex:1;min-width:0}.cf-heading h3{font-size:14px;font-weight:600;line-height:1.3;letter-spacing:.1px;margin:0}.cf-heading p{font-size:11px;color:var(--cf-muted);margin:2px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.deployment-progress button{font:inherit;cursor:pointer}.deployment-progress button:disabled{opacity:.4;cursor:default}.deployment-progress button:focus-visible,.deployment-progress summary:focus-visible,.deployment-progress select:focus-visible{outline:2px solid rgb(var(--v-theme-primary));outline-offset:2px}.cf-icon-button{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--cf-line);border-radius:6px;flex-shrink:0}.cf-icon-button:hover:not(:disabled),.cf-button:hover:not(:disabled){background:rgba(var(--v-theme-on-surface),.06)}
.cf-status-line{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 14px 10px;flex-wrap:wrap}.cf-status{display:inline-flex;align-items:center;gap:6px;min-width:0}.cf-status strong{font-size:12px;font-weight:600}.cf-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0}.cf-target{color:var(--cf-muted);font-size:10px;font-variant-numeric:tabular-nums}.cf-milestones{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:9px 14px;margin:0;background:rgba(var(--v-theme-on-surface),.025);border-block:1px solid var(--cf-line);gap:12px}.cf-milestones div+div{border-left:1px solid var(--cf-line);padding-left:12px}.cf-milestones dt{font-size:10px;color:var(--cf-muted);margin-bottom:2px}.cf-milestones dd{font-size:11px;font-weight:500;margin:0;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
.tone-error{color:rgb(var(--v-theme-error))}.tone-warning{color:rgb(var(--v-theme-warning))}.tone-success{color:rgb(var(--v-theme-success))}.tone-info{color:rgb(var(--v-theme-primary))}.tone-neutral{color:var(--cf-muted)}.cf-notice{display:flex;align-items:flex-start;gap:8px;margin:10px 12px;padding:9px 10px;border:1px solid rgba(var(--v-theme-warning),.18);border-radius:6px;background:rgba(var(--v-theme-warning),.045)}.cf-notice>.v-icon{margin-top:1px;color:rgb(var(--v-theme-warning));flex-shrink:0}.cf-notice.is-failure{border-color:rgba(var(--v-theme-error),.22);background:rgba(var(--v-theme-error),.045)}.cf-notice.is-failure>.v-icon{color:rgb(var(--v-theme-error))}.cf-notice>div{min-width:0}.cf-notice p{margin:0;font-size:11px}.cf-notice-message:not(.expanded){display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.cf-notice .cf-next-step{color:var(--cf-muted);margin-top:4px}.cf-text-button{color:rgb(var(--v-theme-primary));font-size:11px!important;margin-top:3px}.cf-fetch-error{margin:0;padding:8px 14px;color:rgb(var(--v-theme-error))}.cf-empty{text-align:center;padding:22px 16px 26px;color:var(--cf-muted)}.cf-empty p{color:rgb(var(--v-theme-on-surface));margin:8px 0 3px}.cf-empty small{font-size:11px}
.cf-section{border-top:1px solid var(--cf-line)}.cf-section>summary{display:flex;align-items:center;gap:6px;list-style:none;padding:7px 12px;cursor:pointer;font-size:11px;font-weight:500;min-height:32px;box-sizing:border-box}.cf-section>summary::-webkit-details-marker{display:none}.cf-section>summary:hover{background:rgba(var(--v-theme-on-surface),.03)}.cf-chevron{color:var(--cf-muted);flex-shrink:0;transition:transform .12s}.cf-section[open]>summary>.cf-chevron{transform:rotate(90deg)}.cf-count{font-size:10px;color:var(--cf-muted);background:rgba(var(--v-theme-on-surface),.06);padding:0 5px;border-radius:4px;min-width:18px;text-align:center;line-height:18px}.cf-section>summary>span:first-of-type{flex:1}.cf-count.tone-error{color:rgb(var(--v-theme-error));background:rgba(var(--v-theme-error),.08)}.cf-summary-note{margin-left:auto;font-size:10px;font-weight:400}.cf-section-body{padding:0 14px 12px}.cf-section-body>p{margin:5px 0}.cf-muted{color:var(--cf-muted);font-size:11px}.cf-button{border:1px solid var(--cf-line);border-radius:5px;padding:4px 8px;margin:5px 0}.cf-history-picker{display:flex;align-items:center;gap:8px;color:var(--cf-muted);font-size:11px}.deployment-progress select{font:inherit;color:rgb(var(--v-theme-on-surface));background:rgb(var(--v-theme-surface));border:1px solid var(--cf-line);padding:4px 6px;border-radius:5px;max-width:100%;min-width:0;flex:1}
.deployment-progress table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px}.deployment-progress th{text-align:left;color:var(--cf-muted);font-size:10px;font-weight:500;padding:5px 4px;border-bottom:1px solid var(--cf-line)}.deployment-progress th:first-child{width:34%}.deployment-progress th:last-child{width:68px}.deployment-progress td{padding:8px 4px;vertical-align:top;border-bottom:1px solid var(--cf-line)}.deployment-progress td strong{font-weight:500}.deployment-progress td small{display:block;color:var(--cf-muted);font-size:10px;margin-top:2px}.deployment-progress td p{margin:4px 0 0;font-size:10px}.cf-resource-state{font-size:10px}.cf-resource-id summary{cursor:pointer;color:var(--cf-muted);font-size:10px;margin-top:4px}.cf-resource-id code{display:block;margin-top:3px;font-size:10px;word-break:break-all}.cf-time{color:var(--cf-muted);font-size:10px;white-space:nowrap;font-variant-numeric:tabular-nums}.events{max-height:260px;overflow:auto;list-style:none;margin:8px 0 0;padding:0}.events li{border-left:2px solid var(--cf-line);padding:3px 0 8px 9px;margin:0 0 4px}.cf-event-heading{display:flex;gap:10px;justify-content:space-between;font-size:11px}.cf-event-heading small{display:block;font-size:10px;color:var(--cf-muted)}.cf-event-heading time{color:var(--cf-muted);font-size:10px;white-space:nowrap}.events p{font-size:11px;margin:3px 0}.events code{font-size:10px}.deployment-progress pre{font-size:10px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;background:rgba(var(--v-theme-on-surface),.035);border:1px solid var(--cf-line);border-radius:5px;padding:8px;margin:6px 0}.cf-log-heading{color:var(--cf-muted)}
.cf-operation>summary{padding-right:36px;font-size:10px;color:var(--cf-muted);font-weight:400}.cf-operation>summary>span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cf-operation time{margin-left:auto;font-size:10px;white-space:nowrap}.cf-operation-data{display:grid;grid-template-columns:112px minmax(0,1fr);gap:5px 10px;font-size:10px;margin:0}.cf-operation-data dt{color:var(--cf-muted)}.cf-operation-data dd{margin:0;overflow-wrap:anywhere}.cf-section-body :deep(.lifecycle){border:0;margin:0;padding:0}.cf-spinning{animation:cf-spin 1s linear infinite}@keyframes cf-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.cf-spinning{animation:none}.cf-chevron{transition:none}}
</style>
