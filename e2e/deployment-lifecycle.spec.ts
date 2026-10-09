import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
test('CF node restores recovery review after reload, requires its human digest, and keeps long evidence scrollable',async({page})=>{
 const graphId=randomUUID(),nodeId='stack',root='**/crdt/'+graphId+'/iac/'+nodeId;
 const stack={name:'gapp-browser-stack',account:'230639770018',region:'us-west-1',environment:'dev'};
 const inspection={checkedAt:new Date().toISOString(),application:{status:'NOT_CREATED',ownership:'absent'},guardrail:{status:'ROLLBACK_FAILED',ownership:'verified'},roles:[{logicalId:'WorkerRole',exists:false},{logicalId:'ExecutionRole',exists:false}],recoveryReadiness:{state:'review-available'},historicalFailure:{message:'Historical permission denial'},historicalFailureOperationId:'original-failed-operation',assumption:{result:'not-tested'},blockers:[{code:'RECOVERY_REQUIRED',kind:'recovery',message:'Retained boundary needs recovery.'}]};
 let status:any={operationId:'01M4C000000000000000000000',state:'failed',revisionId:'rev_accepted',updatedAt:Date.now(),inspection,canReviewMaintenance:false,maintenanceConfiguration:{configured:false,mode:'record-and-verify-only',executesAws:false},progress:{resources:[]}},approval:any=null,reviewRequest:any=null;
 await page.addInitScript(()=>localStorage.setItem('plastic-user-preferences',JSON.stringify({userName:'Reviewer',userId:'reviewer',email:'',avatar:'',workstationId:'lifecycle-test',graphHTTPServer:'http://localhost:3030/',graphWSSServer:'ws://localhost:3030/',useLocalStorage:false,showMap:false,newNodeHelp:false})));
 await page.route(root+'/review*',route=>route.fulfill({json:{status}}));
 await page.route(root+'/events*',route=>route.fulfill({json:{events:[],nextCursor:'cursor',hasMore:false}}));
 await page.route(root+'/operations*',route=>route.fulfill({json:{operations:[status],nextCursor:null}}));
 await page.route(root+'/inspect*',route=>route.fulfill({json:inspection}));
 await page.route(root+'/recovery-plan',route=>{
  const request=route.request().postDataJSON();expect(request.operationId).toBe(status.operationId);
  status={...status,operationId:'01M4C000000000000000000001',state:'recovery-ready',expiresAt:Date.now()+60000,recoveryPlan:{digest:'exact-recovery-digest',sourceOperationId:request.operationId,preservesData:true,prerequisites:[],actions:[{kind:'import-retained',target:'guardrail',dataLoss:[],resources:Array.from({length:35},(_,i)=>({logicalId:'RetainedResource'+i,physicalId:'owned-resource-'+i,outcome:'Retain'}))}]}};
  return route.fulfill({json:{status}});
 });
 await page.route(root+'/recovery-approve',route=>{approval=route.request().postDataJSON();status={...status,state:'recovered',recoveryApproval:{digest:approval.recoveryDigest,at:Date.now()},nextActions:{actions:[{tool:'iac.review',allowed:true}]}};return route.fulfill({json:{status}});});
 await page.route(root+'/plan',route=>{reviewRequest=route.request().postDataJSON();status={...status,state:'planning',progress:{phase:'planning',resources:[]},operationId:'01M4C000000000000000000002',recoveryPlan:null,recoveryApproval:null,nextActions:{actions:[]}};return route.fulfill({json:{status}});});
 await page.goto('http://localhost:4188/graph-editor/'+graphId);
 await page.waitForFunction(()=>!!(document.querySelector('#app') as any)?.__vue_app__?.config.globalProperties.$pinia._s.get('graph')?.graphSnapshot);
 await page.evaluate(async({nodeId,stack})=>{
  const graph=(document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('graph');
  graph.graphSnapshot.nodes.push({id:nodeId,url:nodeId,version:0,graphId:graph.graphSnapshot.id,data:null,artifact:null,edges:[],properties:{name:'Application stack',inputs:[],outputs:[],groups:[],tags:[],x:200,y:100,z:0,createdOn:Date.now(),presentation:{x:200,y:100,z:0},iac:{stack,template:{format:'json',text:'{"Resources":{}}'}}},template:{set:'',vue:''}});
  await graph.updateGraphFromSnapshot('Lifecycle browser fixture');
 },{nodeId,stack});
 const node=page.locator('#node-'+nodeId),lifecycle=node.getByTestId('deployment-lifecycle');
 await expect(lifecycle).toContainText('ROLLBACK_FAILED');await expect(lifecycle).toContainText('WorkerRole: Absent');await expect(lifecycle).toContainText('not a current permission check');await expect(lifecycle.getByTestId('recovery-available')).toBeVisible();await lifecycle.getByRole('button',{name:'Prepare recovery plan',exact:true}).click();
 await expect(lifecycle).toContainText('exact-recovery-digest');await expect(lifecycle).toContainText('Platform-maintenance administrator membership is not required');expect(approval).toBeNull();
 const dimensions=await node.evaluate((el:any)=>({height:el.clientHeight,width:el.clientWidth,scroll:el.scrollHeight,overflow:getComputedStyle(el).overflowY}));
 expect(dimensions.height).toBeLessThanOrEqual(480);expect(dimensions.width).toBeLessThanOrEqual(640);expect(dimensions.scroll).toBeGreaterThan(dimensions.height);expect(dimensions.overflow).toBe('auto');
 await page.reload();await expect(lifecycle).toContainText('exact-recovery-digest');expect(approval).toBeNull();
 await lifecycle.getByRole('button',{name:'Approve this recovery',exact:true}).click();
 expect(approval).toEqual({operationId:'01M4C000000000000000000001',recoveryDigest:'exact-recovery-digest',confirmDataLoss:false});
 await expect(lifecycle).toContainText('next application deployment needs a fresh review');expect(reviewRequest).toBeNull();
 await lifecycle.getByRole('button',{name:'Prepare fresh deployment review',exact:true}).click();
 expect(reviewRequest.retryOf).toBe('01M4C000000000000000000001');await expect(node.getByTestId('deployment-progress')).toContainText('Planning');
});
