import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {flushPromises,mount} from '@vue/test-utils';
import Lifecycle from '../DeploymentLifecycle.vue';
const mock=vi.hoisted(()=>({store:null as any}));
vi.mock('@plastic-io/graph-editor-vue3-orchestrator',()=>({useStore:()=>mock.store}));
const inspection={checkedAt:'2026-10-08T04:00:00Z',application:{status:'NOT_CREATED',ownership:'absent'},guardrail:{status:'ROLLBACK_FAILED',ownership:'verified'},assumption:{result:'not-tested'},blockers:[{code:'PLATFORM_PERMISSION_REQUIRED',kind:'platform-permission',message:'Missing cleanup permission',action:'iam:DeleteRolePolicy',resource:'owned-role'}]};
const failed={operationId:'failed-operation',state:'failed',inspection};
const plan={sourceOperationId:'failed-operation',digest:'exact-recovery-digest',preservesData:true,prerequisites:[],actions:[{kind:'delete-stack',target:'guardrail',resources:[{logicalId:'RuntimeBoundary',physicalId:'owned-policy',outcome:'Retain'}],dataLoss:[]},{kind:'import-retained',target:'guardrail',resources:[{logicalId:'RuntimeBoundary',physicalId:'owned-policy'}],dataLoss:[]}]};
let wrapper:any,provider:any;
beforeEach(()=>{
 let id=0;vi.stubGlobal('crypto',{randomUUID:()=>`request-${++id}`});
 provider={stackReview:vi.fn(),inspectStack:vi.fn(async()=>inspection),recoveryPlan:vi.fn(async()=>({status:{}})),approveRecovery:vi.fn(async()=>({status:{}})),planStack:vi.fn(),stackMaintenance:vi.fn(),runtimeLogs:vi.fn(async()=>({events:[],unavailable:true,reason:'No Lambda request ID exists for this invocation.'})),stackReadiness:vi.fn(async()=>({state:'verified'}))};
 mock.store={syncProviders:[provider]};
});
afterEach(()=>{wrapper?.unmount();wrapper=null;vi.unstubAllGlobals();});
async function open(status:any=failed){wrapper=mount(Lifecycle,{props:{graphId:'g',nodeId:'stack',status}});await flushPromises();return wrapper;}
async function click(text:string){const button=wrapper.findAll('button').find((b:any)=>b.text()===text);expect(button).toBeTruthy();await button.trigger('click');await flushPromises();}
describe('Graph-native recovery controls',()=>{
 it('shows current evidence, prepares a plan without executing and submits only the human-reviewed recovery digest',async()=>{
  await open();expect(wrapper.text()).toContain('ROLLBACK_FAILED');expect(wrapper.text()).toContain('iam:DeleteRolePolicy');
  await click('Check current readiness');expect(provider.inspectStack).toHaveBeenCalledWith('g','stack','failed-operation');
  await click('Prepare recovery plan');expect(provider.recoveryPlan).toHaveBeenCalledWith('g','stack',{operationId:'failed-operation',idempotencyKey:'request-1',allowDataLoss:false});
  expect(provider.approveRecovery).not.toHaveBeenCalled();expect(provider.planStack).not.toHaveBeenCalled();
  await wrapper.setProps({status:{...failed,operationId:'recovery',state:'recovery-ready',recoveryPlan:plan,expiresAt:Date.now()+60000}});
  expect(wrapper.text()).toContain('owned-policy');expect(wrapper.text()).toContain('Approving recovery does not approve a new application template.');
  await click('Approve this recovery');expect(provider.approveRecovery).toHaveBeenCalledWith('g','stack',{operationId:'recovery',recoveryDigest:plan.digest,confirmDataLoss:false});
  expect(provider.planStack).not.toHaveBeenCalled();
  await wrapper.setProps({status:{...failed,operationId:'recovery',state:'recovered',nextActions:{actions:[{tool:'iac.review',allowed:true}]}}});
  await click('Prepare fresh deployment review');expect(provider.planStack).toHaveBeenCalledWith('g','stack',false,'apply','recovery');
 });
 it('requires the explicit data-loss checkbox and retains a stable idempotency key after a lost response',async()=>{
  await open();provider.recoveryPlan.mockRejectedValueOnce(new Error('Connection interrupted'));
  await click('Prepare recovery plan');await click('Prepare recovery plan');expect(provider.recoveryPlan.mock.calls[0]).toEqual(provider.recoveryPlan.mock.calls[1]);
  await wrapper.setProps({status:{...failed,operationId:'recovery',state:'recovery-ready',recoveryPlan:{...plan,preservesData:false,actions:[{kind:'delete-stack',target:'application',dataLoss:['Records']}]}}});
  const button=wrapper.findAll('button').find((b:any)=>b.text()==='Approve this recovery');expect(button.attributes('disabled')).toBeDefined();
  expect(wrapper.text()).toContain('Data deletion: Records');
  const confirm=wrapper.findAll('label').find((l:any)=>l.text().includes('I approve the listed data deletions')).find('input');await confirm.setValue(true);
  await click('Approve this recovery');expect(provider.approveRecovery.mock.calls[0][2].confirmDataLoss).toBe(true);
 });
 it('does not reuse stale or expired approvals and discards a late inspection when the operation changes',async()=>{
  await open({...failed,state:'recovery-ready',recoveryPlan:plan,expiresAt:Date.now()-100});
  expect(wrapper.text()).toContain('review expired');expect(wrapper.findAll('button').some((b:any)=>b.text()==='Approve this recovery')).toBe(false);
  await click('Prepare recovery plan');expect(provider.approveRecovery).not.toHaveBeenCalled();
  let finish:any;provider.inspectStack.mockImplementationOnce(()=>new Promise(r=>finish=r));const pending=wrapper.vm.inspect();
  await wrapper.setProps({status:{operationId:'new',state:'planning'}});finish(inspection);await pending;expect(wrapper.vm.currentInspection).toBeNull();expect(wrapper.vm.busy).toBe(false);
  await wrapper.setProps({status:{...failed,state:'recovery-ready',recoveryPlan:plan,expiresAt:Date.now()+60000}});
  provider.approveRecovery.mockRejectedValueOnce(new Error('AWS state changed. Prepare a new recovery plan.'));
  await click('Approve this recovery');expect(wrapper.find('[role="alert"]').text()).toContain('AWS state changed');expect(provider.approveRecovery).toHaveBeenCalledTimes(1);
 });
 it('keeps platform maintenance review separate and displays its required action/resource',async()=>{
  await open();await click('Request platform maintenance review');expect(provider.stackMaintenance.mock.calls[0][2].action).toBe('request');
  const maintenance={state:'requested',digest:'maintenance-digest',requirements:inspection.blockers,verification:['Deploy through platform CI.']};
  await wrapper.setProps({status:{...failed,maintenance}});expect(wrapper.text()).toContain('explicitly configured platform administrator');
  expect(wrapper.findAll('button').some((b:any)=>b.text()==='Approve separate platform maintenance')).toBe(false);
  await wrapper.setProps({status:{...failed,maintenance,canReviewMaintenance:true}});await click('Approve separate platform maintenance');
  expect(provider.stackMaintenance).toHaveBeenLastCalledWith('g','stack',{operationId:'failed-operation',action:'approve',maintenanceDigest:'maintenance-digest'});
  expect(provider.approveRecovery).not.toHaveBeenCalled();expect(provider.planStack).not.toHaveBeenCalled();
 });
 it('makes absent-role recovery reviewable without a maintenance administrator and explains record-only maintenance',async()=>{
  const current={...inspection,blockers:[],roles:[{logicalId:'WorkerRole',exists:false},{logicalId:'ExecutionRole',exists:'unknown'}],recoveryReadiness:{state:'review-available'},historicalFailure:{message:'Old IAM denial'},historicalFailureOperationId:'original'};
  await open({operationId:'recover',state:'recovery-ready',inspection:current,recoveryPlan:plan,expiresAt:Date.now()+60000,canReviewMaintenance:false,maintenanceConfiguration:{configured:false,blocker:{code:'PLATFORM_ADMIN_NOT_CONFIGURED',message:'No platform-maintenance administrator is configured. Configure PLATFORM_ADMIN_SUBS through the platform release process.'}}});
  expect(wrapper.get('[data-testid="recovery-available"]').text()).toContain('do not need to exist before recovery approval');
  expect(wrapper.text()).toContain('WorkerRole: Absent');expect(wrapper.text()).toContain('ExecutionRole: Unknown');
  expect(wrapper.text()).toContain('not a current permission check');
  await click('Approve this recovery');expect(provider.approveRecovery).toHaveBeenCalledTimes(1);expect(provider.stackMaintenance).not.toHaveBeenCalled();
  await wrapper.setProps({status:{...wrapper.props('status'),state:'recovery-blocked',inspection,maintenance:{state:'requested',digest:'maintenance-digest',requirements:inspection.blockers}}});
  expect(wrapper.get('[data-testid="maintenance-configuration"]').text()).toContain('PLATFORM_ADMIN_SUBS');
  expect(wrapper.text()).toContain('does not execute AWS changes, trigger a release');
  expect(wrapper.findAll('button').some((b:any)=>b.text()==='Approve this recovery')).toBe(false);
  expect(wrapper.findAll('button').some((b:any)=>b.text()==='Approve separate platform maintenance')).toBe(false);
 });
 it('shows runtime diagnostics and declared readiness separately from deployment completion',async()=>{
  await open({operationId:'deployed',state:'succeeded',resources:[{logicalId:'Backend',resourceType:'AWS::Lambda::Function'}],readinessChecks:[{id:'health',description:'Assert application health.'}]});
  expect(wrapper.text()).toContain('Runtime readiness: Not verified');await wrapper.find('select').setValue('Backend');
  await click('Read last 15 minutes');expect(wrapper.text()).toContain('No Lambda request ID');
  await click('Run health');expect(provider.stackReadiness).toHaveBeenCalledWith('g','stack',{checkId:'health',idempotencyKey:'request-1'});
  expect(wrapper.props('status').state).toBe('succeeded');expect(provider.approveRecovery).not.toHaveBeenCalled();
 });
});
