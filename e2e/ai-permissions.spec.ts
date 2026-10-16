import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';

test('AI Permissions coordinates proposal and deployment approval without promoting Safe Actions to Full',async({page})=>{
 const graphId=randomUUID(),root='**/crdt/'+graphId;
 const eligibility=(safe:boolean)=>({modes:{'safe-actions':{allowed:safe},'fully-automatic':{allowed:true}}});
 let proposal:any={proposalId:'proposal',proposalDigest:'proposal-exact',state:'awaiting-review',description:'Rename fixture',validation:{ok:true},automaticApproval:eligibility(true)},proposalApproval:any=null,deploymentApproval:any=null;
 let status:any={operationId:'deployment',action:'apply',state:'awaiting-review',reviewDigest:'deployment-exact',automaticApproval:eligibility(false)};
 await page.addInitScript(()=>localStorage.setItem('plastic-user-preferences',JSON.stringify({userName:'Reviewer',userId:'reviewer',email:'',avatar:'',workstationId:'permissions-test',graphHTTPServer:'http://localhost:3030/',graphWSSServer:'ws://localhost:3030/',useLocalStorage:false,showMap:false,newNodeHelp:false})));
 await page.route(root+'/audit*',route=>route.fulfill({json:{records:[]}}));
 await page.route(root+'/proposals',route=>route.fulfill({json:{proposals:[proposal]}}));
 await page.route(root+'/proposals/proposal/commit',route=>{proposalApproval=route.request().postDataJSON();proposal={...proposal,state:'committed'};return route.fulfill({json:{proposal,result:{decision:'accepted'}}});});
 await page.route(root+'/stacks',route=>route.fulfill({json:{canPlan:true,canReview:true,stacks:[{nodeId:'stack',name:'Fixture',stack:{name:'gapp-fixture-stack',region:'us-west-1'},validation:{ok:true,problems:[]},status}]}}));
 await page.route(root+'/iac/stack/review*',route=>route.fulfill({json:{status}}));
 await page.route(root+'/iac/stack/apply',route=>{deploymentApproval=route.request().postDataJSON();status={...status,state:'apply-requested'};return route.fulfill({json:{status}});});
 await page.goto('http://localhost:4188/graph-editor/'+graphId);
 const button=page.getByTestId('ai-permissions'),warning=page.getByTestId('ai-permissions-warning');
 await expect(button).toContainText('Manual');expect(proposalApproval).toBeNull();expect(deploymentApproval).toBeNull();
 await button.click();await page.getByTestId('ai-mode-safe-actions').click();
 await warning.getByRole('button',{name:'Enable Safe Actions',exact:true}).click();
 await expect.poll(()=>proposalApproval).toEqual({proposalDigest:'proposal-exact',aiPermissionMode:'safe-actions'});
 expect(deploymentApproval).toBeNull();
 await button.click();await page.getByTestId('ai-mode-fully-automatic').click();
 await warning.getByRole('button',{name:'Enable Fully Automatic',exact:true}).click();
 await expect.poll(()=>deploymentApproval).toEqual({operationId:'deployment',reviewDigest:'deployment-exact',approvalMode:'automatic',aiPermissionMode:'fully-automatic',confirmDestructive:false});
 await button.click();await page.getByTestId('ai-mode-manual').click();await expect(button).toContainText('Manual');
 await expect(warning).not.toBeVisible();
});
