/**
 * Crockford base32 ULID: 48-bit millisecond time + 80 bits of randomness (26
 * chars).  The graph server requires mutation ids in this shape (plan §5.1),
 * and observation ids use the monotonic form so that two observations minted
 * in the same millisecond still sort in the order they happened, which is what
 * makes a cursor over them stable.
 *
 * `crypto.getRandomValues` is a web standard present in browsers and in Node
 * 18+, so this file keeps the package free of both DOM and Node built-ins.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(now: number): string {
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  return time;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const source: any = (globalThis as any).crypto;
  if (source && typeof source.getRandomValues === "function") {
    source.getRandomValues(bytes);
    return bytes;
  }
  // Only reached where the web crypto global is absent (an old test sandbox).
  // Ids stay unique enough to order events; they are not used as secrets.
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function randomChars(): string {
  const bytes = randomBytes(16);
  let rand = "";
  for (let i = 0; i < 16; i++) {
    rand += ALPHABET[bytes[i] % 32];
  }
  return rand;
}

export function newUlid(now: number = Date.now()): string {
  return encodeTime(now) + randomChars();
}

/** Increment a Crockford base32 string in place; returns null when it would overflow. */
function incrementBase32(s: string): string | null {
  const chars = s.split("");
  for (let i = chars.length - 1; i >= 0; i--) {
    const index = ALPHABET.indexOf(chars[i]);
    if (index < ALPHABET.length - 1) {
      chars[i] = ALPHABET[index + 1];
      return chars.join("");
    }
    chars[i] = ALPHABET[0];
  }
  return null;
}

/**
 * A generator whose ids strictly increase: within one millisecond the random
 * part is incremented rather than drawn again, so `id` order is event order.
 */
export function monotonicUlid(): (now?: number) => string {
  let lastTime = 0;
  let lastRandom = "";
  return (now: number = Date.now()) => {
    if (now <= lastTime) {
      const next = incrementBase32(lastRandom);
      if (next) {
        lastRandom = next;
        return encodeTime(lastTime) + lastRandom;
      }
      lastTime += 1;                 // overflow: borrow a millisecond from the future
      lastRandom = randomChars();
      return encodeTime(lastTime) + lastRandom;
    }
    lastTime = now;
    lastRandom = randomChars();
    return encodeTime(lastTime) + lastRandom;
  };
}
