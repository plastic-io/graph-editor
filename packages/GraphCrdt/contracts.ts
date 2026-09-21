/**
 * Port contracts (plan §4.3.5, PB-045).
 *
 * Two questions are asked of a contract, in two different places.  At connect
 * time the editor asks whether an output may feed an input at all, which is a
 * question about the declared types and can be answered without a value.  At
 * delivery time the runtime asks whether a value matches the port's JSON
 * Schema, which needs a validator and so lives with the runtime that has one
 * (the server's `src/runtime/contracts.ts`).  This module holds the first,
 * because both domains ask it.
 */

/** Conservative assignability: same declared type, or either side untyped/Object. */
export function assignable(from: any, to: any): boolean {
  const a = from && from.type ? String(from.type) : "Object";
  const b = to && to.type ? String(to.type) : "Object";
  return a === b || a === "Object" || b === "Object";
}

const JSON_TYPE_OF: Record<string, string> = {
  String: "string",
  Number: "number",
  Boolean: "boolean",
  Object: "object",
  Array: "array",
};

/**
 * Why a connection the types allow would still deliver values the receiving
 * port refuses: the two schemas name different JSON types, or the input
 * requires properties the output's schema says it never produces.  Returns
 * null when nothing can be said statically, which is the common case.
 */
export function schemaConflict(from: any, to: any): string | null {
  const a = from && from.schema;
  const b = to && to.schema;
  if (!b || typeof b !== "object") {
    return null;
  }
  const declared = from && from.type ? JSON_TYPE_OF[String(from.type)] : undefined;
  const aType = (a && typeof a === "object" && typeof a.type === "string" ? a.type : declared);
  const bType = typeof b.type === "string" ? b.type : undefined;
  if (aType && bType && aType !== bType && !(aType === "integer" && bType === "number") && !(aType === "number" && bType === "integer")) {
    return `it produces ${aType} and the input expects ${bType}`;
  }
  if (Array.isArray(b.required) && a && typeof a === "object" && a.properties && typeof a.properties === "object" && a.additionalProperties === false) {
    const produced = Object.keys(a.properties);
    const missing = b.required.filter((k: string) => !produced.includes(k));
    if (missing.length) {
      return `the input requires ${missing.join(", ")}, which it never produces`;
    }
  }
  return null;
}
