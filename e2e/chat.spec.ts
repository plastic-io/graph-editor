import {test, expect, type BrowserContext, type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
// The companion server owns the MCP SDK used against its actual HTTP endpoint.
const {Client, StreamableHTTPClientTransport} = require('../../graph-server/node_modules/@modelcontextprotocol/client');
const SERVER = process.env.CHAT_API || 'http://localhost:3030';
const EDITOR = process.env.CHAT_EDITOR || 'http://localhost:4188/graph-editor';

async function account(context: BrowserContext, user: string) {
  await context.addInitScript(({server, user}) => localStorage.setItem('plastic-user-preferences', JSON.stringify({
    userName:user, email:'', userId:user, avatar:'', workstationId:user,
    graphHTTPServer:server+'/', graphWSSServer:server.replace(/^http/,'ws')+'/?user='+user,
    remoteConfiguration:'', useLocalStorage:false, showMap:false, showLabels:true, newNodeHelp:false,
  })), {server:SERVER,user});
}
async function ready(page: Page) {
  await page.waitForFunction(() => (document.querySelector('#app') as any)?.__vue_app__?.config.globalProperties.$pinia._s.get('chat')?.client?.state.me);
}
async function state(page: Page) {
  return page.evaluate(() => JSON.parse(JSON.stringify((document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('chat').client.state)));
}
async function send(page: Page, text: string, interrupt = false) {
  await page.getByLabel('Message', {exact:true}).fill(text);
  if (interrupt) await page.getByLabel('Interrupt agents', {exact:true}).check();
  await page.getByRole('button', {name:'Send', exact:true}).click();
  await expect(page.getByLabel('Message', {exact:true})).toHaveValue('');
}

test('Yjs chat connects graph viewers, private inboxes on the TOC, and independent MCP agents', async ({browser}, testInfo) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const clients: any[] = [];
  try {
    const id = randomUUID();
    await Promise.all(contexts.map((c,i)=>account(c,['alice','bob','carol'][i]+'-'+id.slice(0,8))));
    const [alice,bob,carol] = await Promise.all(contexts.map(c=>c.newPage()));
    await alice.goto(`${EDITOR}/${id}`);
    await alice.waitForFunction(() => (document.querySelector('#app') as any)?.__vue_app__?.config.globalProperties.$pinia._s.get('graph')?.graphSnapshot);
    await alice.evaluate(async () => {
      const graph = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('graph');
      graph.graphSnapshot.properties.name = 'Shared chat test';
      await graph.updateGraphFromSnapshot('Create a graph for chat');
    });
    await expect.poll(async()=> (await (await fetch(`${SERVER}/crdt/${id}/state`)).json()).exists).toBe(true);
    await Promise.all([bob.goto(`${EDITOR}/${id}`), carol.goto(`${EDITOR}/${id}`)]);
    await Promise.all([alice,bob,carol].map(ready));
    await Promise.all([alice,bob,carol].map(p=>p.getByRole('button',{name:'Open chat',exact:true}).click()));
    await send(alice, '@here Hello graph viewers');
    await expect(bob.getByRole('log')).toContainText('Hello graph viewers');
    await expect(carol.getByRole('log')).toContainText('Hello graph viewers');
    const [aliceInfo,bobInfo] = [(await state(alice)).me,(await state(bob)).me];
    await expect.poll(async() => (await state(alice)).people.some((p:any)=>p.id===bobInfo.id)).toBe(true);

    // A mention routes privately even when typed in the public graph room.
    await send(alice, `@${bobInfo.handle} Private review for Bob`);
    await expect(alice.getByRole('log')).toContainText('Private review for Bob');
    await expect.poll(async()=>(await state(bob)).unreadDirect[aliceInfo.id]).toBe(1);
    await expect(bob.getByRole('log')).not.toContainText('Private review for Bob');
    await expect(carol.getByRole('log')).not.toContainText('Private review for Bob');
    expect((await state(carol)).threads).toHaveLength(0);
    await bob.getByRole('button',{name:'Read',exact:true}).click();
    await expect(bob.getByRole('log')).toContainText('Private review for Bob');
    await send(bob, 'Private reply for Alice');
    await expect(alice.getByRole('log')).toContainText('Private reply for Alice');

    // The same private inbox is available outside a graph and survives reload.
    await bob.getByRole('button',{name:'Close chat',exact:true}).click();
    await bob.evaluate(() => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$router.push('/'));
    await expect(bob).toHaveURL(`${EDITOR}/`); await ready(bob);
    await send(alice, 'Still private on the table of contents');
    await expect.poll(async()=>(await state(bob)).unreadDirect[aliceInfo.id]).toBeGreaterThan(0);
    await bob.getByRole('button',{name:'Read',exact:true}).click();
    await expect(bob.getByRole('log')).toContainText('Still private on the table of contents');
    await bob.reload(); await ready(bob);
    await bob.getByRole('button',{name:'Open chat',exact:true}).click();
    await bob.locator('.chat-controls .v-select').click();
    await bob.getByRole('listbox').getByText('@'+aliceInfo.handle, {exact:false}).click();
    await expect(bob.getByRole('log')).toContainText('Private review for Bob');
    await expect(bob.getByRole('log')).toContainText('Still private on the table of contents');

    for (const name of ['Planner','Builder']) {
      const client = new Client({name,version:'1.0.0'}, {versionNegotiation:{mode:'auto'}}); clients.push(client);
      await client.connect(new StreamableHTTPClientTransport(new URL(`${SERVER}/mcp`)));
    }
    const sessions = ['plan-'+id,'build-'+id];
    const call = async (i:number,name:string,args:any={}) => {
      const response = await clients[i].callTool({name,arguments:{schemaVersion:1,graphId:id,agentSessionId:sessions[i],...args}});
      return response.structuredContent || JSON.parse(response.content[0].text);
    };
    for (const i of [0,1]) {
      expect((await call(i,'chat.join',{name:['Planner','Builder'][i]})).error).toBeUndefined();
      expect((await call(i,'chat.post',{messageId:randomUUID(),text:`@here Agent ${i} planning`,phase:'thinking'})).error).toBeUndefined();
    }
    await expect(carol.getByRole('log')).toContainText('Agent 0 planning');
    await expect(carol.getByRole('log')).toContainText('Agent 1 planning');
    await send(carol, '@here Pause for the revised contract', true);
    for (const i of [0,1]) expect((await call(i,'revision.cut')).error?.code).toBe('CHAT_INTERRUPTED');
    const listened = await call(0,'chat.wait',{after:0,timeoutMs:0});
    const interruption = listened.result.pendingInterruptions.find((m:any)=>m.text.includes('revised contract'));
    expect(interruption).toBeTruthy();
    expect((await call(0,'chat.post',{messageId:randomUUID(),text:'I will use the revised contract.',phase:'acknowledged',acknowledges:[interruption.id]})).error).toBeUndefined();
    expect((await call(0,'revision.cut')).error).toBeUndefined();
    expect((await call(1,'revision.cut')).error?.code).toBe('CHAT_INTERRUPTED');
    await expect(carol.getByRole('log')).toContainText('I will use the revised contract.');
    for (const phase of ['doing','done']) expect((await call(0,'chat.post',{messageId:randomUUID(),text:`@here Agent 0 ${phase}`,phase})).error).toBeUndefined();
    await expect(carol.getByRole('log')).toContainText('Agent 0 done');

    // An MCP sender has the same private routing rules as a browser sender.
    expect((await call(0,'chat.post',{messageId:randomUUID(),text:`@${aliceInfo.handle} Private agent feedback`})).error).toBeUndefined();
    await expect.poll(async()=>Object.values((await state(alice)).unreadDirect).some(n=>Number(n)>0)).toBe(true);
    await expect(carol.getByRole('log')).not.toContainText('Private agent feedback');
    await carol.screenshot({path:testInfo.outputPath('graph-chat.png'),fullPage:true});
    await bob.setViewportSize({width:390,height:844});
    await expect(bob.getByRole('button',{name:'Send',exact:true})).toBeInViewport();
    await bob.screenshot({path:testInfo.outputPath('private-chat-mobile.png'),fullPage:true});
  } finally {await Promise.all(clients.map(c=>c.close())); await Promise.all(contexts.map(c=>c.close()));}
});
