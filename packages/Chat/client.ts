import {reactive} from 'vue';
import {ChatDocument} from './document';

export interface Person {id: string; name: string; handle: string; online?: boolean}
export interface Message {id: string; seq: number; at: string; text: string; phase: string; interrupt: boolean; acknowledges: string[]; sender: {id: string; userId: string; name: string; role: string}}
interface Thread {peer: Person; room: string; latestSeq: number; at: string}
interface Socket {
  state: string; events: Record<string, any>; send(value: any): void;
  subscribe(channel: string, listener: (value: any) => void): void;
  unsubscribe(channel: string, listener: (value: any) => void): void;
  onOpen(listener: () => void): () => void;
  onSessionEnd(listener: () => void): () => void;
}
/** A mention selects one private recipient. Unknown/ambiguous names fail closed. */
export function recipientFor(text: string, people: Person[], selected?: Person): Person | undefined {
  const handles = [...text.matchAll(/(?:^|[^\w@])@([a-zA-Z0-9][a-zA-Z0-9_-]*)\b/g)].map(m => m[1].toLowerCase());
  const direct = [...new Set(handles.filter(h => h !== 'here'))];
  if (direct.length > 1) throw new Error('Send a private message to one person at a time.');
  if (direct.length) {
    const found = people.filter(p => p.handle.toLowerCase() === direct[0] || p.name.toLowerCase() === direct[0]);
    if (found.length !== 1) throw new Error('Choose an exact @handle from the people list.');
    if (selected && selected.id !== found[0].id) throw new Error('This mention names someone outside the selected private conversation.');
    if (handles.includes('here')) throw new Error('Use @here for the graph room or @handle for a private message.');
    return found[0];
  }
  if (selected && handles.includes('here')) throw new Error('@here belongs in the graph room.');
  return selected;
}

export class ChatClient {
  readonly state = reactive({me: null as Person | null, people: [] as Person[], threads: [] as Thread[], graphId: '', peerId: '',
    graphMessages: [] as Message[], directMessages: [] as Message[], graphHasOlder: false, directHasOlder: false,
    visible: false, loading: false, error: '', unreadGraph: 0, unreadDirect: {} as Record<string, number>, notification: null as Person | null});
  private graphDoc = new ChatDocument();
  private directDoc = new ChatDocument();
  private graphCursor = 0;
  private directCursor = 0;
  private graphLoaded = false;
  private directLoaded = false;
  private epoch = 0;
  private graphEpoch = 0;
  private directEpoch = 0;
  private personal = '';
  private pending = new Map<string, (error: Error) => void>();
  private detachOpen: () => void;
  private detachSession: () => void;
  private timer: ReturnType<typeof setInterval>;
  private refreshing = false;
  constructor(readonly socket: Socket) {
    this.detachOpen = socket.onOpen(() => {void this.refresh();});
    this.detachSession = socket.onSessionEnd(() => this.reset());
    this.timer = setInterval(() => {void this.refresh();}, 8000);
    if (socket.state === 'open') void this.refresh();
  }
  get unread() {return this.state.unreadGraph + Object.values(this.state.unreadDirect).reduce((a, b) => a + b, 0);}
  private marker(room: string) {return `graph-chat-read:${this.state.me?.id}:${room}`;}
  private readMarker(room: string) {try {return Number(localStorage.getItem(this.marker(room))) || 0;} catch {return 0;}}
  private writeMarker(room: string, seq: number) {try {localStorage.setItem(this.marker(room), String(Math.max(seq, this.readMarker(room))));} catch { /* read indicators remain in memory */ }}
  request(operation: string, args: any = {}): Promise<any> {
    if (this.socket.state !== 'open') return Promise.reject(new Error('Messaging is reconnecting. Your draft has been kept.'));
    return new Promise((resolve, reject) => {
      const messageId = crypto.randomUUID();
      const finish = () => {clearTimeout(timer); delete this.socket.events[messageId]; this.pending.delete(messageId);};
      const fail = (error: Error) => {finish(); reject(error);};
      const timer = setTimeout(() => fail(new Error('No message receipt yet. Retry to check delivery without sending a duplicate.')), 25000);
      this.pending.set(messageId, fail);
      const items: any[] = [];
      this.socket.events[messageId] = (response: any) => {
        if (response?.error) return fail(new Error(response.error));
        if (response?.chunk) {
          const {field, final} = response.chunk;
          if (!['people', 'threads'].includes(field) || !Array.isArray(response[field])) return fail(new Error('Invalid messaging response.'));
          items.push(...response[field]);
          if (!final) return;
          response = {...response, [field]: items}; delete response.chunk;
        }
        finish(); resolve(response);
      };
      this.socket.send({action: 'chat', operation, messageId, args});
    });
  }
  private onGraph = (event: any) => {
    if (event?.eventType !== 'chat.update' || event.graphId !== this.state.graphId) return;
    const fresh = !this.state.graphMessages.some(m => m.id === event.message.id);
    this.state.graphMessages = this.graphDoc.apply(event);
    if (fresh && !(this.state.visible && !this.state.peerId) && event.message.sender.id !== `human:${this.state.me?.id}`) this.state.unreadGraph++;
    if (this.state.visible && !this.state.peerId) this.markRead();
  };
  private onDirect = (event: any) => {
    if (event?.eventType !== 'chat.update' || !event.peer?.id) return;
    const peer = event.peer as Person;
    const prior = this.state.threads.find(t => t.peer.id === peer.id);
    const latestSeq = Math.max(prior?.latestSeq || 0, event.message.seq);
    this.state.threads = [{peer, room: event.room, latestSeq, at: event.message.at}, ...this.state.threads.filter(t => t.peer.id !== peer.id)];
    if (peer.id === this.state.peerId) this.state.directMessages = this.directDoc.apply(event);
    if (this.state.visible && peer.id === this.state.peerId) this.markRead();
    else if (event.message.sender.id !== `human:${this.state.me?.id}`) {
      this.state.unreadDirect[peer.id] = Math.max(0, latestSeq - this.readMarker(event.room));
      this.state.notification = peer;
    }
  };
  async refresh() {
    if (this.refreshing || this.socket.state !== 'open') return;
    this.refreshing = true;
    const epoch = this.epoch;
    try {
      const directory = await this.request('directory');
      if (epoch !== this.epoch) return;
      this.state.me = directory.me; this.state.people = directory.people;
      const channel = `chat-user-${directory.me.id}`;
      if (channel !== this.personal) {
        if (this.personal) this.socket.unsubscribe(this.personal, this.onDirect);
        this.personal = channel; this.socket.subscribe(channel, this.onDirect);
      }
      const inbox = await this.request('inbox');
      if (epoch !== this.epoch) return;
      this.state.threads = inbox.threads;
      for (const thread of inbox.threads) this.state.unreadDirect[thread.peer.id] = Math.max(0, thread.latestSeq - this.readMarker(thread.room));
      const graphChannel = `graph-chat-${this.state.graphId}`;
      if (this.state.graphId && !this.socket.events[graphChannel]?.includes(this.onGraph)) this.socket.subscribe(graphChannel, this.onGraph);
      await Promise.all([this.loadGraph(), this.loadDirect()]);
      if (epoch === this.epoch) {this.state.error = ''; if (this.state.visible) this.markRead();}
    } catch (err: any) {if (epoch === this.epoch) this.state.error = err.message;}
    finally {this.refreshing = false;}
  }
  async setGraph(graphId: string) {
    if (graphId === this.state.graphId) return;
    if (this.state.graphId) this.socket.unsubscribe(`graph-chat-${this.state.graphId}`, this.onGraph);
    this.graphEpoch++; this.graphDoc.reset(); this.state.graphId = graphId; this.graphCursor = 0; this.graphLoaded = false; this.state.graphMessages = []; this.state.unreadGraph = 0; this.state.graphHasOlder = false;
    if (graphId) {this.socket.subscribe(`graph-chat-${graphId}`, this.onGraph); await this.loadGraph().catch(err => {this.state.error = err.message;});}
  }
  async select(peerId: string) {
    this.directEpoch++; this.directDoc.reset(); this.state.peerId = peerId; this.state.directMessages = []; this.directCursor = 0; this.directLoaded = false; this.state.directHasOlder = false; this.state.error = '';
    if (peerId) await this.loadDirect().catch(err => {this.state.error = err.message;});
    this.markRead();
  }
  private async loadGraph() {
    if (!this.state.graphId || this.socket.state !== 'open') return;
    const epoch = this.graphEpoch, session = this.epoch, graphId = this.state.graphId;
    for (let count = 0; count < 20; count++) {
      const initial = !this.graphLoaded;
      const page = await this.request('history', {graphId, stateVector: this.graphDoc.vector(), ...(initial ? {} : {after: this.graphCursor})});
      if (epoch !== this.graphEpoch || session !== this.epoch) return;
      const merged = this.graphDoc.apply(page);
      const incoming = merged.filter((m: Message) => !this.state.graphMessages.some(old => old.id === m.id));
      this.state.graphMessages = merged;
      this.graphCursor = page.cursor; this.graphLoaded = true;
      if (initial) this.state.graphHasOlder = page.hasMore;
      else if (!(this.state.visible && !this.state.peerId)) this.state.unreadGraph += incoming.filter((m: Message) => m.sender.id !== `human:${this.state.me?.id}`).length;
      if (initial || !page.hasMore) return;
    }
  }
  private async loadDirect() {
    if (!this.state.peerId || this.socket.state !== 'open') return;
    const epoch = this.directEpoch, session = this.epoch, peerId = this.state.peerId;
    for (let count = 0; count < 20; count++) {
      const initial = !this.directLoaded;
      const page = await this.request('history', {peerId, stateVector: this.directDoc.vector(), ...(initial ? {} : {after: this.directCursor})});
      if (epoch !== this.directEpoch || session !== this.epoch) return;
      this.state.directMessages = this.directDoc.apply(page); this.directCursor = page.cursor; this.directLoaded = true;
      if (initial) this.state.directHasOlder = page.hasMore;
      if (initial || !page.hasMore) return;
    }
  }
  async older() {
    const peerId = this.state.peerId, graphId = this.state.graphId;
    const current = peerId ? this.state.directMessages : this.state.graphMessages;
    if (!current.length) return;
    const session = this.epoch;
    const page = await this.request('history', {...(peerId ? {peerId} : {graphId}), stateVector: (peerId ? this.directDoc : this.graphDoc).vector(), before: current[0].seq});
    if (session !== this.epoch || peerId !== this.state.peerId || graphId !== this.state.graphId) return;
    if (peerId) {this.state.directMessages = this.directDoc.apply(page); this.state.directHasOlder = page.hasMore;}
    else {this.state.graphMessages = this.graphDoc.apply(page); this.state.graphHasOlder = page.hasMore;}
  }
  markRead() {
    if (this.state.peerId) {
      const thread = this.state.threads.find(t => t.peer.id === this.state.peerId);
      if (thread) this.writeMarker(thread.room, this.state.directMessages[this.state.directMessages.length - 1]?.seq || 0);
      this.state.unreadDirect[this.state.peerId] = 0;
    } else this.state.unreadGraph = 0;
  }
  async post(messageId: string, text: string, interrupt: boolean) {
    const selected = this.state.people.find(p => p.id === this.state.peerId) || this.state.threads.find(t => t.peer.id === this.state.peerId)?.peer;
    const recipient = recipientFor(text, this.state.people, selected);
    if (!recipient && !this.state.graphId) throw new Error('Choose a person for a private conversation.');
    const args = {messageId, text, interrupt, ...(recipient ? {peerId: recipient.id} : {graphId: this.state.graphId})};
    const session = this.epoch, selection = this.directEpoch;
    const result = await this.request('post', args);
    if (session !== this.epoch) return;
    if (recipient) {
      if (selection === this.directEpoch && this.state.peerId !== recipient.id) await this.select(recipient.id);
      this.onDirect({eventType:'chat.update', ...result, peer:recipient});
    } else this.onGraph({eventType:'chat.update', ...result, graphId: (args as any).graphId});
    this.markRead();
  }
  private reset() {
    this.epoch++; this.graphEpoch++; this.directEpoch++;
    this.graphDoc.reset(); this.directDoc.reset();
    this.pending.forEach(reject => reject(new Error('The messaging session ended.')));
    this.personal = ''; this.graphCursor = 0; this.directCursor = 0; this.graphLoaded = false; this.directLoaded = false;
    this.state.me = null; this.state.people = []; this.state.threads = []; this.state.graphMessages = []; this.state.directMessages = [];
    this.state.unreadDirect = {}; this.state.unreadGraph = 0; this.state.peerId = ''; this.state.notification = null; this.state.visible = false;
  }
  dispose() {
    clearInterval(this.timer); this.detachOpen(); this.detachSession();
    if (this.personal) this.socket.unsubscribe(this.personal, this.onDirect);
    if (this.state.graphId) this.socket.unsubscribe(`graph-chat-${this.state.graphId}`, this.onGraph);
    this.reset(); this.graphDoc.destroy(); this.directDoc.destroy();
  }
}
