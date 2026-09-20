import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

/**
 * The Yjs sync protocol, carried over the API Gateway WebSocket.
 *
 * API Gateway routes on a JSON field in the message body, so the binary
 * protocol payloads travel base64 encoded inside a small JSON envelope rather
 * than as raw frames.  Both the editor and the Lambda import this module so
 * there is one definition of the wire format.
 */

export const MESSAGE_SYNC_STEP1 = 0;
export const MESSAGE_SYNC_STEP2 = 1;
export const MESSAGE_UPDATE = 2;

export interface SyncMessage {
  type: number;
  content: Uint8Array;
}

export function readSyncMessage(payload: Uint8Array): SyncMessage {
  const decoder = decoding.createDecoder(payload);
  const type = decoding.readVarUint(decoder);
  const content = decoding.readVarUint8Array(decoder);
  return { type, content };
}

function write(type: number, content: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, type);
  encoding.writeVarUint8Array(encoder, content);
  return encoding.toUint8Array(encoder);
}

/** "Here is what I have; send me what I am missing." */
export function writeSyncStep1(stateVector: Uint8Array): Uint8Array {
  return write(MESSAGE_SYNC_STEP1, stateVector);
}

/** "Here is everything you were missing." */
export function writeSyncStep2(update: Uint8Array): Uint8Array {
  return write(MESSAGE_SYNC_STEP2, update);
}

/** "Here is one new change." */
export function writeUpdate(update: Uint8Array): Uint8Array {
  return write(MESSAGE_UPDATE, update);
}

/* ------------------------------------------------------------------ *
 * base64, working in both the browser and the Lambda
 * ------------------------------------------------------------------ */

export function toBase64(bytes: Uint8Array): string {
  const anyGlobal: any = typeof globalThis !== "undefined" ? globalThis : {};
  if (anyGlobal.Buffer) {
    return anyGlobal.Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as any,
    );
  }
  return anyGlobal.btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const anyGlobal: any = typeof globalThis !== "undefined" ? globalThis : {};
  if (anyGlobal.Buffer) {
    return new Uint8Array(anyGlobal.Buffer.from(value, "base64"));
  }
  const binary = anyGlobal.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Subscription channel carrying document traffic for one graph. */
export function channelIdFor(graphId: string): string {
  return `graph-crdt-${graphId}`;
}
