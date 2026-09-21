// Crockford base32 ULID: 48-bit millisecond time + 80 bits of randomness (26 chars).
// The graph server requires mutation ids in this shape (plan §5.1).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function newUlid(now: number = Date.now()): string {
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let rand = "";
  for (let i = 0; i < 16; i++) {
    rand += ALPHABET[bytes[i] % 32];
  }
  return time + rand;
}
