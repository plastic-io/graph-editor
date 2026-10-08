import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {flushPromises,mount} from '@vue/test-utils';
import Progress from '../DeploymentProgress.vue';
const mock=vi.hoisted(()=>({store:null as any}));
vi.mock('@plastic-io/graph-editor-vue3-orchestrator',()=>({useStore:()=>mock.store}));
const operationId='01M4CSD7D7H7YM2HKY2Z5AJRHZ';
const event=(over:any={})=>({schemaVersion:1,eventType:'deployment.progress',provenance:'server',id:'deployment:operation:resource',kind:'deployment.resource',graphId:'g',nodeId:'stack',operationId,correlationId:operationId,revisionId:'rev_accepted',inputDigest:'a'.repeat(64),reviewDigest:null,sequence:1,at:'2026-10-08T03:37:50.000Z',receivedAt:'2026-10-08T03:37:51.000Z',source:'cloudformation',phase:'guardrails',stackName:'graph-guardrails-example',logicalId:'WorkerRole',resourceType:'AWS::IAM::Role',status:'CREATE_FAILED',reason:'The platform guardrail role is not authorized to perform iam:GetRole on the assigned worker role.',...over});
let listener:any,reconnect:any,wrapper:any,provider:any,bus:any,status:any,pages:any[];
beforeEach(()=>{
 vi.useFakeTimers();pages=[];status={operationId,state:'planning',revisionId:'rev_accepted',updatedAt:Date.now(),progress:{phase:'guardrails',resources:[]}};
 provider={stackReview:vi.fn(async()=>({status})),stackEvents:vi.fn(async()=>pages.shift()||{events:[],nextCursor:'cursor',hasMore:false}),stackOperations:vi.fn(async()=>({operations:[{operationId,state:'planning',createdAt:Date.now()}],nextCursor:null}))};
 bus={subscribe:vi.fn((_channel,cb)=>{listener=cb;}),unsubscribe:vi.fn(),onOpen:vi.fn(cb=>{reconnect=cb;return vi.fn();})};
 mock.store={syncProviders:[provider],dataProviders:{graph:bus}};
});
afterEach(()=>{wrapper?.unmount();wrapper=null;vi.useRealTimers();});
async function open(){wrapper=mount(Progress,{props:{graphId:'g',nodeId:'stack'}});await flushPromises();return wrapper;}
describe('CloudFormation node diagnostics',()=>{
 it('renders a failure before application stack creation from the same structured bus events MCP watches',async()=>{
  await open();expect(wrapper.text()).toContain('Preparing guardrails');
  const failed=event();listener({response:failed});await flushPromises();
  expect(wrapper.text()).toContain('iam:GetRole');expect(wrapper.text()).toContain('WorkerRole');expect(wrapper.text()).toContain('CREATE_FAILED');
  status={...status,state:'failed',reason:failed.reason,progress:{phase:'terminal',resources:[failed]},recovery:{category:'platform-intervention',message:'Correct the named action and complete guardrail cleanup.'},manualRecoveryRequired:true};
  pages.push({events:[failed,event({id:'log',source:'cloudwatch',kind:'deployment.log',logicalId:undefined,reason:undefined,message:'Original guardrail failure',error:{code:'AccessDenied',message:'Original guardrail failure',trace:['worker.js:42']}})],nextCursor:'after-failure',hasMore:false});
  await vi.advanceTimersByTimeAsync(300);await flushPromises();
  expect(wrapper.text()).toContain('Failed');expect(wrapper.text()).toContain('Deployment approval: Not recorded');expect(wrapper.text()).toContain('Correct the named action');expect(wrapper.text()).toContain('worker.js:42');
  expect(wrapper.findAll('tbody tr')).toHaveLength(1);expect(wrapper.findAll('ol.events li').filter((row:any)=>row.text().includes('iam:GetRole'))).toHaveLength(1);
  expect(wrapper.text()).toContain('accepted graph is not deployment approval');
 });
 it('recovers missed and late events after reconnect and restores an operation on a new mount',async()=>{
  await open();const old=event({id:'old',sequence:2,at:'2026-10-08T03:37:49.000Z'}),latest=event({id:'latest',sequence:1,status:'DELETE_FAILED',at:'2026-10-08T03:37:55.000Z',reason:'iam:DeleteRolePolicy denied'});
  listener(latest);pages.push({events:[latest,old],nextCursor:'recovered',hasMore:false});reconnect();await flushPromises();
  expect(provider.stackEvents).toHaveBeenLastCalledWith('g','stack',{operationId,cursor:'cursor',limit:50});
  expect(wrapper.findAll('ol.events li')).toHaveLength(2);expect(wrapper.find('tbody tr').text()).toContain('DELETE_FAILED');
  const callback=listener;wrapper.unmount();wrapper=null;expect(bus.unsubscribe).toHaveBeenCalledWith('graph-notify-g',callback);
  status={...status,state:'failed',progress:{phase:'terminal',resources:[latest]}};pages.push({events:[old,latest],nextCursor:'restored',hasMore:false});await open();
  expect(wrapper.findAll('ol.events li')).toHaveLength(2);expect(provider.stackEvents).toHaveBeenLastCalledWith('g','stack',{operationId,cursor:undefined,limit:50});
 });
 it('does not approve deployments while progressing from planning through rollback and completion',async()=>{
  await open();for(const [state,phase,label]of [['awaiting-review','awaiting-approval','Awaiting deployment approval'],['applying','deploying','Deploying'],['applying','rolling-back','Rolling back'],['succeeded','terminal','succeeded']]){
   status={...status,state,approval:state==='awaiting-review'?undefined:{reviewDigest:'exact'},progress:{phase,resources:[]}};
   await wrapper.vm.refresh();expect(wrapper.text()).toContain(label);
  }
  expect(Object.keys(provider)).toEqual(['stackReview','stackEvents','stackOperations']);
  expect(wrapper.text()).toContain('Recorded for this review digest');
 });
 it('isolates other graph/node events and discards a stale refresh when navigating between graphs',async()=>{
  await open();listener(event({graphId:'other'}));listener(event({nodeId:'other'}));listener(event({provenance:'browser-report'}));await flushPromises();expect(wrapper.findAll('ol.events li')).toHaveLength(0);
  let resolve:any;provider.stackReview.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const pending=wrapper.vm.refresh();
  status={...status,operationId:'new-operation'};await wrapper.setProps({graphId:'new-graph'});await flushPromises();
  resolve({status:{operationId:'old-operation',state:'failed'}});await pending;
  expect(wrapper.vm.status.operationId).toBe('new-operation');expect(wrapper.vm.busy).toBe(false);
 });
 it('loads longer pages and lets a user reopen previous operations without changing the current one',async()=>{
  pages.push({events:[event()],nextCursor:'page-2',hasMore:true});await open();
  pages.push({events:[event({id:'two',sequence:2,reason:'Additional diagnostics'})],nextCursor:'page-3',hasMore:false});
  const button=wrapper.findAll('button').find((b:any)=>b.text()==='Load more diagnostic events');await button!.trigger('click');await flushPromises();expect(wrapper.text()).toContain('Additional diagnostics');
  await wrapper.find('select').setValue(operationId);await flushPromises();expect(provider.stackReview).toHaveBeenLastCalledWith('g','stack',operationId);
 });
});
