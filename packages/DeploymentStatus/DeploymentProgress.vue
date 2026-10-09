<template>
  <section class="deployment-progress" data-testid="deployment-progress" @pointerdown.stop @click.stop @wheel.stop>
    <header><strong>CloudFormation · {{ phaseLabel }}</strong><button type="button" :disabled="busy" @click="refresh">Refresh</button></header>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="!status && !busy">No deployment review yet. Accepting graph changes does not deploy infrastructure.</p>
    <template v-if="status">
      <p class="milestones">Graph revision: {{ status.revisionId || 'live' }}<br/>Deployment approval: {{ status.approval ? (status.approval.mode === 'automatic' ? 'Automatically approved for this review digest' : 'Recorded for this review digest') : 'Not recorded' }}<br/>Deployment: {{ status.state }}</p>
      <p v-if="latest?.reason">{{ latest.reason }}</p>
      <p v-if="status.reason" :class="failed ? 'failure' : ''">{{ status.reason }}</p>
      <p v-if="status.error" class="failure">{{ status.error.code }}: {{ status.error.message }}</p>
      <p v-if="status.recovery" class="recovery"><strong>{{ status.recovery.category }}</strong>: {{ status.recovery.message }}</p>
      <p v-if="status.manualRecoveryRequired">Recovery is required. Open Recovery beside the cloud notifications in the lower system bar for a separate recovery review.</p>
      <p v-if="status.progress?.collectionWarning" role="status">{{ status.progress.collectionWarning.reason }}</p>
      <small>Operation {{ status.operationId }} · updated {{ time(status.updatedAt) }}</small>
      <details>
        <summary>Resources and deployment history ({{ resources.length }} resources)</summary>
        <label>Operation <select v-model="selectedOperation" @change="changeOperation"><option value="">Current operation</option><option v-for="op in operations" :key="op.operationId" :value="op.operationId">{{ time(op.createdAt) }} · {{ op.state }} · {{ op.operationId }}</option></select></label>
        <button v-if="historyCursor" type="button" @click="loadHistory(true)">More operations</button>
        <table v-if="resources.length"><thead><tr><th>Resource</th><th>Status / reason</th><th>Time</th></tr></thead><tbody><tr v-for="resource in resources" :key="resource.stackName+'/'+resource.logicalId"><td>{{ resource.logicalId }}<small>{{ resource.resourceType }}<br/>{{ resource.physicalId || resource.stackName }}</small></td><td>{{ resource.status }}<div v-if="resource.reason" :class="/FAILED/.test(resource.status) ? 'failure' : ''">{{ resource.reason }}</div></td><td>{{ time(resource.at) }}</td></tr></tbody></table>
        <ol class="events"><li v-for="event in events" :key="event.id"><time>{{ time(event.at) }}</time> · {{ event.phase }} · {{ event.logicalId || event.source }} · {{ event.status || event.state }}<div>{{ event.reason || event.message || event.error?.message }}</div><small v-if="event.error">{{ event.error.code }}</small></li></ol>
        <button v-if="hasMore" type="button" :disabled="busy" @click="loadEvents()">Load more diagnostic events</button>
        <p v-if="clipped">Showing at most 1,000 loaded events. Complete retained pages are available through iac.events.</p>
      </details>
      <details><summary>Diagnostic logs and collection warnings</summary><p>Redacted platform diagnostics. Application payloads and uncorrelated logs are excluded.</p><pre v-for="entry in logs" :key="entry.id">{{ time(entry.at) }} {{ entry.source }} {{ entry.status }}
{{ entry.message || entry.reason || entry.error?.message }}<template v-if="entry.error?.trace?.length">
{{ entry.error.trace.join('\n') }}</template></pre><p v-if="!logs.length">No diagnostic log entries have been collected.</p></details>
      <p class="milestones">A validated proposal or accepted graph is not deployment approval. Only the exact reviewed digest can be approved in the infrastructure review.</p>
    </template>
    <deployment-lifecycle :graph-id="graphId" :node-id="nodeId" :status="status" :recovery-controls="recoveryControls" @refresh="refresh"/>
  </section>
</template>
<script lang="ts">
import DeploymentLifecycle from './DeploymentLifecycle.vue';
import {useStore as orchestratorStore} from '@plastic-io/graph-editor-vue3-orchestrator';
export default {
  name:'deployment-progress',components:{DeploymentLifecycle},props:{graphId:{type:String,required:true},nodeId:{type:String,required:true},recoveryControls:{type:Boolean,default:true}},emits:['status'],
  data(){return {status:null as any,events:[] as any[],operations:[] as any[],cursor:'',historyCursor:'',hasMore:false,selectedOperation:'',error:'',busy:false,timer:null as any,detach:null as any,generation:0,clipped:false};},
  computed:{
    latest():any{return this.status?.progress?.latest;},
    resources():any[]{
      const rows=new Map<string,any>();
      for(const event of [...(this.status?.progress?.resources||[]),...this.events])if(event.logicalId){const key=event.stackName+'/'+event.logicalId,prior=rows.get(key);if(!prior||event.at>=prior.at)rows.set(key,event);}
      return [...rows.values()];
    },
    logs():any[]{return this.events.filter((e:any)=>['cloudwatch','diagnostics'].includes(e.source)||e.error);},
    failed():boolean{return ['failed','rollback-failed','rolled-back'].includes(this.status?.state);},
    phaseLabel():string{if(this.failed)return 'Failed · '+(this.status?.progress?.phase||this.latest?.phase||'terminal');const labels:any={guardrails:'Preparing guardrails',planning:'Planning', 'awaiting-approval':'Awaiting deployment approval',deploying:'Deploying','rolling-back':'Rolling back',cleanup:'Cleanup',recovering:'Recovering', 'awaiting-recovery-approval':'Awaiting recovery approval',readiness:'Checking readiness',maintenance:'Platform maintenance',runtime:'Runtime diagnostics',terminal:this.status?.state==='recovered'?'Recovery complete':this.status?.state};return labels[this.status?.progress?.phase||this.latest?.phase]||this.status?.state||'Loading';},
  },
  watch:{graphId(){this.start();},nodeId(){this.start();}},
  mounted(){this.start();},beforeUnmount(){this.stop();},
  methods:{
    provider():any{return (orchestratorStore().syncProviders||[]).find((p:any)=>typeof p.stackReview==='function');},
    time(value:any){return value?new Date(value).toLocaleString():'—';},
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
        this.status=status;this.error='';if(!this.selectedOperation&&status)this.$emit('status',status);await this.loadEvents(generation);
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
.deployment-progress{background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));padding:12px;border:1px solid #8886;border-radius:6px;min-width:300px;max-width:850px;font-size:12px;overflow-wrap:anywhere}.deployment-progress header{display:flex;gap:12px;justify-content:space-between}.deployment-progress p{margin:8px 0}.deployment-progress small{display:block;opacity:.8}.deployment-progress button,.deployment-progress select{border:1px solid #8888;border-radius:4px;padding:3px 7px;margin:3px;max-width:100%}.deployment-progress summary{cursor:pointer;padding:8px 0}.deployment-progress table{width:100%;border-collapse:collapse}.deployment-progress td,.deployment-progress th{text-align:left;border-bottom:1px solid #8885;padding:5px;vertical-align:top}.deployment-progress pre{white-space:pre-wrap;padding:8px;background:#8881;max-height:220px;overflow:auto}.events{max-height:300px;overflow:auto;padding-left:20px}.events li{padding:4px}.failure{color:rgb(var(--v-theme-error))}.recovery{border-left:3px solid #e5a032;padding-left:8px}.milestones{opacity:.8}
</style>
