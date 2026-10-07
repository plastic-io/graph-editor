import * as Y from 'yjs';
import {applyUpdate, encodeStateVector, toBase64, fromBase64, UPDATE_FORMAT} from '@plastic-io/graph-crdt';
import type {Message} from './client';

/** A room has its own Y.Doc, never the graph definition's document. Use the
 * same V2 codec as graph collaboration; Yjs makes replay and reordered updates
 * idempotent. Only server-admitted updates enter this replica. */
export class ChatDocument {
  private doc = new Y.Doc();
  apply(sync: {payload: string; updateFormat: number}): Message[] {
    if (sync.updateFormat !== UPDATE_FORMAT || typeof sync.payload !== 'string') throw new Error('Unsupported chat update format. Refresh the editor.');
    applyUpdate(this.doc, fromBase64(sync.payload), 'chat-server');
    return [...this.doc.getMap<Message>('messages').values()].sort((a, b) => a.seq - b.seq);
  }
  vector(): string | undefined {
    const vector = toBase64(encodeStateVector(this.doc));
    return vector.length <= 65536 ? vector : undefined;
  }
  reset() {this.doc.destroy(); this.doc = new Y.Doc();}
  destroy() {this.doc.destroy();}
}
