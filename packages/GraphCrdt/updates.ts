import * as Y from "yjs";

/**
 * The single definition of which Yjs update format this project speaks.
 *
 * Yjs ships two encodings for document updates. The V2 encoding compresses
 * considerably better on structured content, which a graph is, and the Yjs
 * README recommends it for anyone building their own provider. Nothing here
 * has ever been deployed in V1, so there is no format to migrate from.
 *
 * Everything goes through this module rather than calling Yjs directly,
 * because the two formats are not interchangeable and a mistake does not
 * announce itself: applying V2 bytes with the V1 reader throws no error, it
 * simply produces the wrong document. Keeping the choice in one place means
 * there is one thing to read, and one thing to change.
 *
 * A Y.Doc emits `update` and `updateV2` for the same transaction, so a
 * third-party provider that speaks V1, such as y-indexeddb, keeps working
 * alongside this without being aware of it.
 */

/** Stamped on stored records and wire messages so a mismatch is visible. */
export const UPDATE_FORMAT = 2;

/** The document event carrying updates in this format. */
export const UPDATE_EVENT = "updateV2";

/** The whole document, or only what `stateVector` is missing. */
export function encodeState(doc: Y.Doc, stateVector?: Uint8Array): Uint8Array {
  return Y.encodeStateAsUpdateV2(doc, stateVector);
}

export function applyUpdate(doc: Y.Doc, update: Uint8Array, origin?: any): void {
  Y.applyUpdateV2(doc, update, origin);
}

/** Fold several updates into one, which is smaller than the sum of its parts. */
export function mergeUpdates(updates: Uint8Array[]): Uint8Array {
  if (updates.length === 1) {
    return updates[0];
  }
  return Y.mergeUpdatesV2(updates);
}

/** The part of `update` that `stateVector` does not already have. */
export function diffUpdate(update: Uint8Array, stateVector: Uint8Array): Uint8Array {
  return Y.diffUpdateV2(update, stateVector);
}

/** The state vector of an update, without loading it into a document. */
export function stateVectorFromUpdate(update: Uint8Array): Uint8Array {
  return Y.encodeStateVectorFromUpdateV2(update);
}

/**
 * The state vector of a document. State vectors are identical in both
 * formats, so this is here for completeness rather than necessity.
 */
export function encodeStateVector(doc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(doc);
}

/**
 * True when an update carries no changes.
 *
 * A diff against an up-to-date peer is not zero bytes, it is a well formed
 * update describing nothing, so length is the wrong test.
 */
export function isEmptyUpdate(update: Uint8Array): boolean {
  try {
    return Y.parseUpdateMetaV2(update).to.size === 0;
  } catch (err) {
    return false;
  }
}

/** Bytes this document would take to send to a peer that has nothing. */
export function documentSize(doc: Y.Doc): number {
  return encodeState(doc).byteLength;
}
