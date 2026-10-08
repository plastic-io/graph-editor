import {useStore as authStore,authorizedFetch} from "@plastic-io/graph-editor-vue3-authentication-provider";
import {newUlid} from "@plastic-io/graph-crdt";
import {useStore as orchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";

/** Narrow public session and invocation contract; no credential accessor is exposed. */
export function browserApplication(graphId:string){
 const subscriptions=new Set<()=>void>();
 const session={current:()=>{const identity=authStore().identity;return {authenticated:identity.isAuthenticated,sub:identity.isAuthenticated?identity.user.sub:null,provider:identity.provider};}};
 const application={
  async request(nodeUrl:string,field:string,value:any){
   const orchestrator=orchestratorStore();const base=orchestrator.preferencesStore.preferences.graphHTTPServer;
   const node=orchestrator.graphStore.graph.nodes.find((n:any)=>n.url===nodeUrl||n.id===nodeUrl);
   if(!node)throw new Error('Unknown application node: '+nodeUrl);
   const executionId=newUlid();
   const response=await authorizedFetch(new URL('crdt/'+encodeURIComponent(graphId)+'/deliveries',base.endsWith('/')?base:base+'/').href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:1,graphId,nodeId:node.id,field,value,executionId,correlationId:executionId,revisionId:'live',seq:1})});
   if(!response.ok)throw new Error('Authenticated application request failed: '+response.status);
   const result=await response.json();
   if(result.error||result.state==='error')throw new Error(result.error||'Application execution failed');
   return result;

  },
  subscribe(listener:(event:any)=>void){
   const provider:any=orchestratorStore().dataProviders.graph;
   if(!provider?.subscribe)throw new Error('The graph bus is unavailable');
   const channel='graph-notify-'+graphId;
   const receive=(event:any)=>{const message=event?.response||event;if(message?.eventType==='application.update'&&message.provenance==='server'&&message.graphId===graphId)listener(message);};
   provider.subscribe(channel,receive);let active=true;
   const unsubscribe=()=>{if(!active)return;active=false;provider.unsubscribe(channel,receive);subscriptions.delete(unsubscribe);};subscriptions.add(unsubscribe);return unsubscribe;
  },
 };
 return {session,application,dispose:()=>{for(const unsubscribe of subscriptions)unsubscribe();}};
}
