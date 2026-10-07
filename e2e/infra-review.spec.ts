import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const SERVER='http://localhost:3030', EDITOR='http://localhost:4188/graph-editor';

test('CloudFormation template icon and review approval remain visible through list refreshes',async({page})=>{
  const id=randomUUID(),nodeId='infra-stack';
  const template='Resources:\n  Records:\n    Type: AWS::S3::Bucket\n    Properties:\n      BucketName: pio-dev-review-ui\n';
  const stack={name:'pio-dev-review-ui',account:'230639770018',region:'us-west-1',environment:'dev'};
  await page.addInitScript(({server})=>localStorage.setItem('plastic-user-preferences',JSON.stringify({
    userName:'Infrastructure reviewer',userId:'infra-test',email:'',avatar:'',workstationId:'infra-test',
    graphHTTPServer:server+'/',graphWSSServer:server.replace(/^http/,'ws')+'/',remoteConfiguration:'',useLocalStorage:false,showMap:false,newNodeHelp:false,
  })),{server:SERVER});
  let review:any=null,approval:any;
  await page.route('**/crdt/'+id+'/stacks',route=>route.fulfill({json:{stacks:[{nodeId,name:'Records stack',stack,status:null,validation:{ok:true,problems:[],counts:{resources:1}}}],canPlan:true,canReview:true}}));
  await page.route('**/crdt/'+id+'/iac/'+nodeId+'/template',route=>route.fulfill({json:{source:'inline',format:'yaml',text:template}}));
  await page.route('**/crdt/'+id+'/iac/'+nodeId+'/plan',async route=>{
    review={operationId:'01M4C000000000000000000000',state:'awaiting-review',reviewDigest:'exact-review',stack,
      plan:{changes:[{action:'Add',logicalId:'Records',resourceType:'AWS::S3::Bucket'}],destructive:false},template:{text:template,format:'yaml'}};
    await route.fulfill({json:{status:review}});
  });
  await page.route('**/crdt/'+id+'/iac/'+nodeId+'/review',route=>route.fulfill({json:{status:review}}));
  await page.route('**/crdt/'+id+'/iac/'+nodeId+'/apply',route=>{
    approval=route.request().postDataJSON();review={...review,state:'succeeded',outputs:[{key:'RecordsBucket',value:'pio-dev-review-ui'}]};
    return route.fulfill({json:{status:review}});
  });
  await page.goto(EDITOR+'/'+id);
  await page.waitForFunction(()=>!!(document.querySelector('#app') as any)?.__vue_app__?.config.globalProperties.$pinia._s.get('graph')?.graphSnapshot);
  await page.evaluate(async({nodeId,stack,template})=>{
    const graph=(document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('graph');
    graph.graphSnapshot.properties.name='Infrastructure review browser test';
    graph.graphSnapshot.nodes.push({id:nodeId,url:nodeId,version:0,graphId:graph.graphSnapshot.id,data:null,artifact:null,edges:[],
      properties:{name:'Records stack',inputs:[],outputs:[],groups:[],tags:[],x:220,y:180,z:0,createdOn:Date.now(),presentation:{x:220,y:180,z:0},iac:{stack,template:{format:'yaml',text:template}}},
      template:{set:'',vue:'<template><div style="width:180px;height:80px;padding:12px;">Records stack</div></template><script>export default {}<\/script>'}});
    await graph.updateGraphFromSnapshot('Create infrastructure fixture');
  },{nodeId,stack,template});
  await page.locator('#node-'+nodeId).hover();
  await page.getByTestId('cfn-editor-'+nodeId).click();
  await expect(page.getByText('CloudFormation · template',{exact:true})).toBeVisible();
  await expect(page.locator('.monaco-editor').filter({hasText:'BucketName'}).first()).toBeVisible();
  // Editing the YAML follows the same graph mutation path as other node editors.
  await page.evaluate(()=>{
    const element=[...document.querySelectorAll('.monaco-editor')].find((e:any)=>e.pinstance) as any;
    element.pinstance.setValue(element.pinstance.getValue().replace('pio-dev-review-ui','pio-dev-edited-ui'));
  });
  await page.getByTitle('Save',{exact:true}).click();
  await expect.poll(()=>page.evaluate(id=>(document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('graph').graphSnapshot.nodes.find((n:any)=>n.id===id).properties.iac.template.text,nodeId)).toContain('pio-dev-edited-ui');
  await page.getByTestId('cfn-editor-'+nodeId).click();
  await page.getByTitle('What this graph deploys',{exact:true}).click();
  await page.getByRole('button',{name:'Review infrastructure changes',exact:true}).click();
  const dialog=page.getByTestId('infrastructure-review');
  await expect(dialog).toBeVisible();await expect(dialog).toContainText('Ready for your approval');
  await expect(dialog).toContainText('Records');await expect(dialog.getByRole('button',{name:'Approve and apply',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Approve and apply',exact:true}).click();
  await expect(dialog).toContainText('Deployment complete');await expect(dialog).toContainText('RecordsBucket');
  expect(approval).toEqual({operationId:'01M4C000000000000000000000',reviewDigest:'exact-review',confirmDestructive:false});
});
