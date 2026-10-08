import {describe,it,expect,vi,beforeEach} from 'vitest';
import {browserApplication} from '../application';
import {WSSDataProvider} from '../../WssDocumentProvider/main';
const http=vi.fn();
const auth:any={identity:{isAuthenticated:true,provider:'cognito',user:{sub:'alice'},accessToken:'never-copy-this'}};
let orchestrator:any;
vi.mock('@plastic-io/graph-editor-vue3-authentication-provider',()=>({useStore:()=>auth,authorizedFetch:(...args:any[])=>http(...args)}));
vi.mock('@plastic-io/graph-editor-vue3-orchestrator',()=>({useStore:()=>orchestrator}));
const provider=()=>{const p=new WSSDataProvider('wss://test','https://test',()=>{},()=>{},()=>{});p.send=vi.fn();return p;};
beforeEach(()=>{http.mockReset();orchestrator={preferencesStore:{preferences:{graphHTTPServer:'https://api.test/test/'}},graphStore:{graph:{nodes:[{id:'backend-id',url:'backend'}]}},dataProviders:{graph:provider()}};});
describe('authenticated application browser contract',()=>{
 it('uses the existing browser execution transport and exposes no credential accessor',async()=>{
  const b=browserApplication('g');http.mockResolvedValue({ok:true,json:async()=>({state:'completed',executionId:'execution',outputs:[]})});
  expect(b.session.current()).toEqual({authenticated:true,provider:'cognito',sub:'alice'});
  await b.application.request('backend','request',{action:'register'});
  const [url,init]=http.mock.calls[0];expect(url).toBe('https://api.test/test/crdt/g/deliveries');
  const request=JSON.parse(init.body);expect(request).toMatchObject({graphId:'g',nodeId:'backend-id',field:'request',value:{action:'register'},seq:1});
  expect(request.executionId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);expect(init.body).not.toContain('never-copy-this');
  expect(request).not.toHaveProperty('principal');expect(request).not.toHaveProperty('agentSessionId');
 });
 it('two browser subscribers receive the authoritative update and dispose independently',()=>{
  const first=orchestrator.dataProviders.graph,a=browserApplication('g'),alice=vi.fn();a.application.subscribe(alice);
  const second=provider();orchestrator.dataProviders.graph=second;
  const b=browserApplication('g'),bob=vi.fn();b.application.subscribe(bob);
  const update={eventType:'application.update',provenance:'server',graphId:'g',topic:'players',value:['alice','bob'],messageId:'m'};
  for(const p of [first,second])for(const receive of p.events['graph-notify-g'])receive(update);
  expect(alice).toHaveBeenCalledWith(update);expect(bob).toHaveBeenCalledWith(update);
  a.dispose();expect(first.events['graph-notify-g']).toHaveLength(0);expect(second.events['graph-notify-g']).toHaveLength(1);
  for(const receive of second.events['graph-notify-g'])receive({...update,graphId:'other'});
  expect(bob).toHaveBeenCalledTimes(1);b.dispose();
 });
 it('disposing one listener does not unsubscribe a shared WSS channel still in use',()=>{
  const p=orchestrator.dataProviders.graph,existing=()=>{};p.subscribe('graph-notify-g',existing);
  const b=browserApplication('g');b.application.subscribe(()=>{});b.dispose();
  expect(p.send.mock.calls.filter(([m]:any)=>m.action==='unsubscribe')).toHaveLength(0);
  p.unsubscribe('graph-notify-g',existing);
  expect(p.send).toHaveBeenLastCalledWith({action:'unsubscribe',channelId:'graph-notify-g'});
 });
 it('surfaces backend errors instead of returning a misleading success',async()=>{
  http.mockResolvedValue({ok:true,json:async()=>({state:'error',error:'Unsupported action'})});
  await expect(browserApplication('g').application.request('backend','request',{})).rejects.toThrow('Unsupported action');
 });
});
