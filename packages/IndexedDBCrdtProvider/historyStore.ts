/**
 * Append-only log of Yjs updates for one browser.
 *
 * y-indexeddb already persists the document, but it compacts as it goes and
 * exposes no way to walk backwards through time, which is exactly what the
 * rewind transport needs.  This keeps a parallel log of every update together
 * with the description of the action that produced it, so rewind can rebuild
 * the graph as it stood at any point by replaying a prefix of the log.
 */

const DB_NAME = "plastic-io-crdt-history";
const DB_VERSION = 1;
const STORE = "updates";

export interface HistoryRecord {
  seq: number;
  graphId: string;
  time: number;
  description: string;
  userId: string;
  /** Update encoding.  Records in another format are ignored on read. */
  format: number;
  update: Uint8Array;
}

export interface HistoryListing {
  seq: number;
  time: number;
  description: string;
  userId: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "seq",
          autoIncrement: true,
        });
        store.createIndex("graphId", "graphId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export async function appendUpdate(record: Omit<HistoryRecord, "seq">): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readAll(graphId: string): Promise<HistoryRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out: HistoryRecord[] = [];
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("graphId");
    const cursorRequest = index.openCursor(IDBKeyRange.only(graphId));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        out.push(cursor.value as HistoryRecord);
        cursor.continue();
      } else {
        out.sort((a, b) => a.seq - b.seq);
        resolve(out);
      }
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
}

/** Every logged action for a graph, oldest first, without the payloads. */
export async function listHistory(graphId: string): Promise<HistoryListing[]> {
  const records = await readAll(graphId);
  return records.map((record) => ({
    seq: record.seq,
    time: record.time,
    description: record.description,
    userId: record.userId,
  }));
}

/**
 * Every update payload for a graph up to and including `seq`.
 *
 * A record written in a different encoding is skipped rather than handed to a
 * reader that would misinterpret it, because Yjs does not reject an update in
 * the wrong format, it just decodes it into the wrong document.
 */
export async function updatesUpTo(
  graphId: string,
  seq: number,
  format: number,
): Promise<Uint8Array[]> {
  const records = await readAll(graphId);
  const usable = records.filter((record) => record.seq <= seq);
  const wrongFormat = usable.filter((record) => (record.format || 1) !== format);
  if (wrongFormat.length > 0) {
    console.warn(
      `Ignoring ${wrongFormat.length} history records written in an older update format.`,
    );
  }
  return usable
    .filter((record) => (record.format || 1) === format)
    .map((record) => new Uint8Array(record.update));
}

/** Drop a graph's log, used when the graph itself is deleted. */
export async function clearHistory(graphId: string): Promise<void> {
  const db = await openDb();
  const records = await readAll(graphId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    records.forEach((record) => store.delete(record.seq));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
