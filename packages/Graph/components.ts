/**
 * How a published graph's external ports become the ports of the node that
 * imports it (plan §4.3).  Shared by the import and the upgrade paths so both
 * map a component the same way.
 */
export interface FieldMap {
  [name: string]: { id: string; field: string; type: string; visible: boolean; external: false };
}

export function externalFields(graph: any): { inputs: FieldMap; outputs: FieldMap } {
  const inputs: FieldMap = {};
  const outputs: FieldMap = {};
  (graph && graph.nodes ? graph.nodes : []).forEach((v: any) => {
    ((v.properties && v.properties.inputs) || []).forEach((i: any) => {
      if (i.external) {
        inputs[i.name] = { id: v.id, field: i.name, type: i.type, visible: i.visible === undefined ? true : i.visible, external: false };
      }
    });
    ((v.properties && v.properties.outputs) || []).forEach((i: any) => {
      if (i.external) {
        outputs[i.name] = { id: v.id, field: i.name, type: i.type, visible: i.visible === undefined ? true : i.visible, external: false };
      }
    });
  });
  return { inputs, outputs };
}

/** `artifacts/<id>` (a list entry) or `artifacts/<id>.<v>` / `artifacts/<id>/<v>` → the published id. */
export function publishedIdOf(ref: any): string | null {
  if (typeof ref !== "string") return null;
  const m = ref.match(/artifacts\/([A-Za-z0-9_.-]+?)(?:[./](\d+))?(?:\.json)?$/);
  return m ? m[1] : ref.replace(/^artifacts\//, "") || null;
}

/** The pin an imported node carries (plan §4.1.2), from a component manifest. */
export function pinFor(manifest: any) {
  if (!manifest) return undefined;
  return { publishedId: manifest.publishedId, version: manifest.version, digest: manifest.digest };
}
