/**
 * @plastic-io/graph-crdt
 *
 * Shared Yjs document schema, codec and reconciler for Plastic-IO graphs.
 * Imported by both the browser editor and the AWS Lambda graph server, so it
 * must never depend on Vue, Pinia, the DOM, or Node built-ins.
 */
export {
  SCHEMA_VERSION,
  ROOT_KEY,
  GRAPH_TEXT_PROPERTIES,
  NODE_TEXT_PROPERTIES,
  NODE_TEMPLATE_TEXT_FIELDS,
  NODE_OPAQUE_FIELDS,
  NODE_PROPERTY_CONTAINERS,
} from "./schema";
export type { AwarenessState, YjsEnvelope } from "./schema";
export { fromJSON, toJSON, isEmpty, schemaVersionOf } from "./codec";
export { reconcile, deepEqual } from "./reconcile";
export { applyTextDelta, newText } from "./text";
export {
  UPDATE_FORMAT,
  UPDATE_EVENT,
  encodeState,
  applyUpdate,
  mergeUpdates,
  diffUpdate,
  stateVectorFromUpdate,
  encodeStateVector,
  isEmptyUpdate,
  documentSize,
} from "./updates";
export {
  MESSAGE_SYNC_STEP1,
  MESSAGE_SYNC_STEP2,
  MESSAGE_UPDATE,
  readSyncMessage,
  writeSyncStep1,
  writeSyncStep2,
  writeUpdate,
  toBase64,
  fromBase64,
  channelIdFor,
} from "./protocol";
export type { SyncMessage } from "./protocol";

/**
 * Marker used as the `origin` of every transaction produced by a local user
 * action.
 *
 * Yjs hands the origin to every observer, which is how three separate
 * mechanisms stay honest at once: `Y.UndoManager` tracks only transactions
 * whose origin is a LocalOrigin, the network provider knows not to echo a
 * remote update back out, and the history panel reads `description` to label
 * the entry.
 */
export class LocalOrigin {
  description: string;
  /** Actions sharing a batch key are merged into one undo step. */
  batch: string | null;
  constructor(description: string, batch: string | null = null) {
    this.description = description;
    this.batch = batch;
  }
  toString() {
    return `LocalOrigin(${this.description})`;
  }
}

/** Marker for changes applied from a remote peer or from storage. */
export class RemoteOrigin {
  source: string;
  constructor(source: string) {
    this.source = source;
  }
  toString() {
    return `RemoteOrigin(${this.source})`;
  }
}

export function isLocalOrigin(origin: any): origin is LocalOrigin {
  return origin instanceof LocalOrigin;
}

/**
 * Name a change from the marker on the transaction that produced it.
 *
 * A local action carries its own description.  A direct binding such as the
 * code editor carries none, because the text is written straight into the
 * document rather than through an editor action, so it is named for what it
 * is.  Both the browser history log and the server use this, so a graph reads
 * the same way wherever its history is shown.
 */
export function describeOrigin(origin: any): string {
  if (origin instanceof LocalOrigin) {
    return origin.description || "Change";
  }
  if (origin instanceof RemoteOrigin) {
    return origin.source === "seed" ? "Start" : "Remote change";
  }
  if (origin && origin.source === "seed") {
    return "Start";
  }
  if (origin && typeof origin.source === "string") {
    return "Remote change";
  }
  return "Edit Code";
}
