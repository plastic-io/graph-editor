import {beforeEach,describe,it,expect,vi} from 'vitest';
import {createPinia,setActivePinia} from 'pinia';
import {useAiPermissions} from '../../Graph/aiPermissions';
import Menu from '../AiPermissionsMenu.vue';
import Proposals from '../../Proposals/ProposalsMenu.vue';

beforeEach(()=>{setActivePinia(createPinia());});
describe('AI Permissions session and confirmation',()=>{
 it('starts Manual, requires confirmation and resets for another graph or a new session',()=>{
  const permissions=useAiPermissions();permissions.bindGraph('g1');
  const menu:any={...(Menu as any).data(),permissions,graphId:'g1'};
  for(const [key,method] of Object.entries((Menu as any).methods))menu[key]=(method as any).bind(menu);
  expect(permissions.mode).toBe('manual');
  menu.choose('fully-automatic');expect(menu.warningOpen).toBe(true);expect(permissions.mode).toBe('manual');
  menu.confirm();expect(permissions.mode).toBe('fully-automatic');
  menu.choose('manual');expect(permissions.mode).toBe('manual');
  menu.choose('safe-actions');menu.graphId='g2';permissions.bindGraph('g2');menu.confirm();expect(permissions.mode).toBe('manual');
  permissions.setMode('safe-actions');permissions.bindGraph('g2');expect(permissions.mode).toBe('safe-actions');
  permissions.bindGraph('g3');expect(permissions.mode).toBe('manual');
  permissions.setMode('fully-automatic');setActivePinia(createPinia());expect(useAiPermissions().mode).toBe('manual');
 });
});

describe('proposal approval from the selected mode',()=>{
 function fixture(){
  const permissions=useAiPermissions();permissions.bindGraph('g1');
  const proposal={proposalId:'p1',proposalDigest:'exact',state:'awaiting-review',description:'Rename',validation:{ok:true},automaticApproval:{modes:{'safe-actions':{allowed:true},'fully-automatic':{allowed:true}}}};
  const self:any={...(Proposals as any).data(),permissions,graph:{id:'g1'},serverMode:true,inRewindMode:false,proposals:[proposal]};
  for(const [key,method] of Object.entries((Proposals as any).methods))self[key]=(method as any).bind(self);
  Object.defineProperty(self,'permissionMode',{get:()=>permissions.mode});
  self.commitProposal=vi.fn(async()=>({proposal:{...proposal,state:'committed'}}));
  return {self,permissions,proposal};
 }
 it('Manual and preview never approve; Safe Actions sends its exact reviewed digest once',async()=>{
  const {self,permissions,proposal}=fixture();await self.maybeAutoApprove();expect(self.commitProposal).not.toHaveBeenCalled();
  permissions.setMode('safe-actions');self.inRewindMode=true;await self.maybeAutoApprove();expect(self.commitProposal).not.toHaveBeenCalled();
  self.inRewindMode=false;await self.maybeAutoApprove();expect(self.commitProposal).toHaveBeenCalledWith(proposal,{proposalDigest:'exact',aiPermissionMode:'safe-actions'});
  proposal.state='awaiting-review';await self.maybeAutoApprove();expect(self.commitProposal).toHaveBeenCalledOnce();
 });
 it('does not confuse Full eligibility with Safe, invalid proposals or stale work',async()=>{
  const {self,permissions,proposal}=fixture();permissions.setMode('safe-actions');proposal.automaticApproval.modes['safe-actions'].allowed=false;
  await self.maybeAutoApprove();expect(self.commitProposal).not.toHaveBeenCalled();permissions.setMode('fully-automatic');proposal.state='stale';
  await self.maybeAutoApprove();expect(self.commitProposal).not.toHaveBeenCalled();proposal.state='awaiting-review';proposal.validation.ok=false;
  await self.maybeAutoApprove();expect(self.commitProposal).not.toHaveBeenCalled();proposal.validation.ok=true;
  await self.maybeAutoApprove();expect(self.commitProposal).toHaveBeenCalledOnce();
 });
 it('serializes overlapping refreshes and returns to Manual on a refusal',async()=>{
  const {self,permissions}=fixture();permissions.setMode('fully-automatic');let reject:any;
  self.commitProposal=vi.fn(()=>new Promise((_,r)=>reject=r));const first=self.maybeAutoApprove();await self.maybeAutoApprove();expect(self.commitProposal).toHaveBeenCalledOnce();
  reject(new Error('STALE_BASE: graph changed'));await first;expect(permissions.mode).toBe('manual');expect(permissions.stoppedReason).toMatch(/STALE_BASE/);
 });
});
