/**
 * In-place patching of the plain-JSON graph projection.
 *
 * Every change to the CRDT document produces a fresh projection object, but
 * handing that straight to Vue would replace every node object on every
 * keystroke and re-render the whole canvas.  Patching the existing projection
 * instead keeps object identity for everything that did not actually change,
 * so Vue only re-renders the nodes that moved.
 *
 * Arrays of objects carrying an `id` are matched by that id rather than by
 * position, which is the same rule the CRDT reconciler uses and the reason a
 * node deleted from the middle of the list no longer shifts its neighbours'
 * identities.
 */

function isPlainObject(value: any): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Subtrees that are new to the target get cloned rather than shared.  The same
 * projection is patched into three separate trees (the committed graph, the
 * working snapshot and the copy the scheduler watches), and sharing a node
 * object between them would let a mutation of one silently rewrite the others.
 */
function cloneValue(value: any): any {
  if (value === null || typeof value !== "object") {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function patchValue(current: any, next: any): any {
  if (current === next) {
    return next;
  }
  if (Array.isArray(current) && Array.isArray(next)) {
    return patchArray(current, next);
  }
  if (isPlainObject(current) && isPlainObject(next)) {
    return patchObject(current, next);
  }
  return cloneValue(next);
}

function patchArray(current: any[], next: any[]): any[] {
  const keyed =
    next.length > 0 &&
    next.every((item) => isPlainObject(item) && typeof item.id === "string");

  if (keyed) {
    const byId = new Map<string, any>();
    current.forEach((item) => {
      if (isPlainObject(item) && typeof item.id === "string") {
        byId.set(item.id, item);
      }
    });
    const out = next.map((item) => {
      const existing = byId.get(item.id);
      return existing ? patchObject(existing, item) : cloneValue(item);
    });
    for (let i = 0; i < out.length; i += 1) {
      current[i] = out[i];
    }
    current.length = out.length;
    return current;
  }

  const shared = Math.min(current.length, next.length);
  for (let i = 0; i < shared; i += 1) {
    current[i] = patchValue(current[i], next[i]);
  }
  for (let i = shared; i < next.length; i += 1) {
    current[i] = cloneValue(next[i]);
  }
  current.length = next.length;
  return current;
}

function patchObject(current: Record<string, any>, next: Record<string, any>): Record<string, any> {
  Object.keys(current).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      delete current[key];
    }
  });
  Object.keys(next).forEach((key) => {
    current[key] = patchValue(current[key], next[key]);
  });
  return current;
}

/**
 * Patch `target` so that it deep-equals `source`, mutating in place and
 * returning the object that should be used going forward.  When `target` is
 * not an object the source is returned untouched.
 */
export function patchInto(target: any, source: any): any {
  if (isPlainObject(target) && isPlainObject(source)) {
    return patchObject(target, source);
  }
  if (Array.isArray(target) && Array.isArray(source)) {
    return patchArray(target, source);
  }
  return cloneValue(source);
}

export default patchInto;
