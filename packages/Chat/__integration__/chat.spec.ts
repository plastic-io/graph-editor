import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import * as Y from 'yjs';
import {encodeState, toBase64, UPDATE_FORMAT} from '@plastic-io/graph-crdt';
import {ChatDocument} from '../document';
import {ChatClient, recipientFor, type Message} from '../client';
const me = {id:'alice-id',name:'Alice',handle:'alice-a'}, bob = {id:'bob-id',name:'Bob',handle:'bob-b'};
const message = (seq: number): Message => ({id:`m${seq}`,seq,at:new Date().toISOString(),text:`message ${seq}`,phase:'message',interrupt:false,acknowledges:[],sender:{id:'agent:alice:bot',userId:me.id,name:'Agent',role:'agent'}});
const sync = (messages: Message[]) => {const doc = new Y.Doc(); messages.forEach(m=>doc.getMap('messages').set(m.id,m)); const payload=toBase64(encodeState(doc)); doc.destroy(); return {payload,updateFormat:UPDATE_FORMAT};};
const flush = async () => {for (let i=0;i<60;i++) await Promise.resolve();};
class Socket {
  state = 'open'; events: Record<string,any> = {}; sent: any[] = []; messages: Message[] = [];
  opened = new Set<() => void>(); ended = new Set<() => void>(); delayed: any[] = []; hold = false;
  onOpen(f: () => void) {this.opened.add(f); return () => {this.opened.delete(f);};}
  onSessionEnd(f: () => void) {this.ended.add(f); return () => {this.ended.delete(f);};}
  subscribe(ch: string, f: any) {this.events[ch] = [...(this.events[ch] || []), f];}
  unsubscribe(ch: string, f: any) {this.events[ch] = (this.events[ch] || []).filter((x: any) => x !== f);}
  send(frame: any) {
    this.sent.push(frame);
    let response: any;
    if (frame.operation === 'directory') response = {me,people:[me,bob]};
    if (frame.operation === 'inbox') response = {threads:[]};
    if (frame.operation === 'history') {
      const all = this.messages.filter(m => frame.args.after === undefined || m.seq > frame.args.after);
      const messages = frame.args.after === undefined ? all.slice(-10) : all.slice(0,10);
      response = {...sync(messages),cursor:messages[messages.length-1]?.seq || frame.args.after || 0,latestSeq:this.messages.length,hasMore:all.length>10};
      if (this.hold) {this.delayed.push(() => this.events[frame.messageId]?.(response)); return;}
    }
    this.events[frame.messageId]?.(response);
  }
}
let clients: ChatClient[] = [];
beforeEach(() => {vi.useFakeTimers(); vi.stubGlobal('crypto',{randomUUID}); localStorage.clear();});
afterEach(() => {clients.forEach(c => c.dispose()); clients=[]; vi.useRealTimers(); vi.unstubAllGlobals();});
function create(socket: Socket) {const c = new ChatClient(socket); clients.push(c); return c;}

describe('chat delivery and private recipient selection', () => {
  it('keeps @here public and resolves @handle to exactly one private account', () => {
    expect(recipientFor('@here Planning', [me,bob])).toBeUndefined();
    expect(recipientFor('Hello @bob-b', [me,bob])).toEqual(bob);
    expect(recipientFor('Hello (@bob-b)', [me,bob])).toEqual(bob);
    expect(recipientFor('Email alice@example.com', [me,bob])).toBeUndefined();
    expect(() => recipientFor('@unknown secret', [me,bob])).toThrow('exact @handle');
    expect(() => recipientFor('@here @bob-b secret', [me,bob])).toThrow('graph room');
    expect(() => recipientFor('@alice-a @bob-b secret', [me,bob])).toThrow('one person');
    expect(() => recipientFor('@bob-b secret', [me,bob], me)).toThrow('outside');
  });
  it('uses a separate Yjs document for each room and rejects a mismatched encoding', () => {
    const a = new ChatDocument(), b = new ChatDocument();
    const one = sync([message(1)]), two = sync([message(2)]);
    expect(a.apply(one)).toHaveLength(1); a.apply(two); a.apply(one);
    b.apply(two); expect(b.apply(one)).toEqual(a.apply(two));
    expect(b.apply(one).map(m=>m.seq)).toEqual([1,2]);
    expect(() => b.apply({...one,updateFormat:1})).toThrow('format');
    a.reset(); expect(a.apply(sync([]))).toEqual([]); a.destroy(); b.destroy();
  });
  it('registers receipt handlers before sending and catches up more than one page after an initially empty room', async () => {
    const socket = new Socket(), c=create(socket); await flush(); await c.setGraph('g1');
    socket.messages = Array.from({length:24},(_,i)=>message(i+1));
    await c.refresh();
    expect(c.state.graphMessages.map(m=>m.seq)).toEqual(Array.from({length:24},(_,i)=>i+1));
    expect(c.state.unreadGraph).toBe(24);
    await c.refresh(); expect(c.state.unreadGraph).toBe(24);
    expect(Object.keys(socket.events).filter(k=>!k.startsWith('chat-user-')&&!k.startsWith('graph-chat-'))).toEqual([]);
  });
  it('assembles a directory split across bounded WebSocket frames before resolving', async () => {
    const socket = new Socket(), original = socket.send.bind(socket);
    socket.send = frame => {
      if (frame.operation !== 'directory') return original(frame);
      socket.events[frame.messageId]({me,people:[me],chunk:{field:'people',final:false}});
      expect(socket.events[frame.messageId]).toBeTypeOf('function');
      socket.events[frame.messageId]({me,people:[bob],chunk:{field:'people',final:true}});
    };
    const c = create(socket); await flush();
    expect(c.state.people).toEqual([me,bob]);
    expect(c.state.error).toBe('');
  });
  it('drops an old graph history response after navigating to another graph', async () => {
    const socket = new Socket(), c=create(socket); await flush(); socket.messages=[message(1)]; socket.hold=true;
    const old = c.setGraph('g1'); await flush(); socket.hold=false; socket.messages=[]; await c.setGraph('g2');
    socket.delayed.forEach(resolve=>resolve()); await old;
    expect(c.state.graphId).toBe('g2'); expect(c.state.graphMessages).toEqual([]);
  });
  it('receives private messages while the panel is closed and removes all content on logout', async () => {
    const socket = new Socket(), c=create(socket); await flush();
    const incoming={...message(1),sender:{id:'human:bob-id',userId:bob.id,name:'Bob',role:'human'}};
    socket.events['chat-user-alice-id'][0]({eventType:'chat.update',room:'direct-room',peer:bob,message:incoming,...sync([incoming])});
    expect(c.state.notification).toEqual(bob); expect(c.unread).toBe(1); expect(c.state.graphMessages).toEqual([]);
    socket.ended.forEach(f=>f()); socket.events={};
    expect(c.state.threads).toEqual([]); expect(c.state.me).toBeNull(); expect(c.unread).toBe(0);
    socket.opened.forEach(f=>f()); await flush(); expect(socket.events['chat-user-alice-id']).toHaveLength(1);
  });
});
