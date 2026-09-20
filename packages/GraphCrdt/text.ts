import * as Y from "yjs";

/**
 * Replace the contents of a Y.Text with `next`, touching only the range that
 * actually changed.
 *
 * A full delete and re-insert would work but it would destroy every remote
 * cursor anchored in the text and would turn a one character edit into an
 * update the size of the whole document.  Trimming the common prefix and
 * suffix gets character level granularity for the overwhelmingly common cases
 * (typing, pasting a block, deleting a line) at a fraction of the cost of a
 * real diff algorithm.
 */
export function applyTextDelta(text: Y.Text, next: string): boolean {
  const prev = text.toString();
  if (prev === next) {
    return false;
  }
  const prevLen = prev.length;
  const nextLen = next.length;
  const maxPrefix = Math.min(prevLen, nextLen);

  let prefix = 0;
  while (prefix < maxPrefix && prev.charCodeAt(prefix) === next.charCodeAt(prefix)) {
    prefix += 1;
  }

  // Do not let the prefix and suffix scans overlap on the shorter string.
  const maxSuffix = maxPrefix - prefix;
  let suffix = 0;
  while (
    suffix < maxSuffix &&
    prev.charCodeAt(prevLen - 1 - suffix) === next.charCodeAt(nextLen - 1 - suffix)
  ) {
    suffix += 1;
  }

  const removed = prevLen - prefix - suffix;
  const inserted = next.slice(prefix, nextLen - suffix);

  if (removed > 0) {
    text.delete(prefix, removed);
  }
  if (inserted.length > 0) {
    text.insert(prefix, inserted);
  }
  return true;
}

/** Create a Y.Text pre-filled with `value`. */
export function newText(value: unknown): Y.Text {
  const text = new Y.Text();
  const str = typeof value === "string" ? value : value == null ? "" : String(value);
  if (str.length > 0) {
    text.insert(0, str);
  }
  return text;
}
