import patchInto from "./project";
import { useStore as useOrchestratorStore } from "@plastic-io/graph-editor-vue3-orchestrator";

/**
 * Looking inside a call (plan PB-115).
 *
 * A node can carry another graph, and since the runtime makes a **call** of
 * every one of them (D-38), what is inside a node is not part of this document
 * at all: it is a component, named by the chain of host nodes it was reached
 * through — `left`, then `left/call` — and it may not even be here yet, in
 * which case it is fetched the way the runtime fetches it.
 *
 * So this is a read-only view, and deliberately: what you are looking at
 * belongs to the component's own document, where it can be edited and
 * published.  Changing it here would be changing a copy of somebody else's
 * graph inside yours, which is the thing importing a component exists to avoid.
 *
 * The mechanism is the one rewind already uses — the loaded graph is patched
 * into the snapshot the canvas draws, and the editing surfaces refuse while it
 * is there — because "showing a graph nobody may edit" is one problem, not two.
 */

/** A host node's graph: the copy it carries, or the component it names. */
async function graphOf(store: any, host: any): Promise<any> {
  const linked = host && host.linkedGraph;
  if (!linked) {
    return null;
  }
  if (linked.graph) {
    return linked.graph;
  }
  if (!linked.id) {
    return null;
  }
  const version = linked.version === undefined ? host.version : linked.version;
  let found: any = null;
  await useOrchestratorStore().load({
    url: `artifacts/graph/${linked.id}.${version}`,
    setValue: (value: any) => { found = value; },
  });
  return found;
}

export default {
  /**
   * Show what is inside the call this path names, reached from the document
   * this graph is.  The path is the chain of host node ids, which is what an
   * instance is named by everywhere else.
   */
  async lookInside(path: string[]): Promise<any> {
    const steps: string[] = (path || []).filter(Boolean);
    if (!steps.length) {
      return this.leaveInstance();
    }
    const document = this.insideInstance ? this.insideInstance.document : this.graph;
    if (!document) {
      return null;
    }
    const trail: { nodeId: string; name: string; graphId: string }[] = [];
    let current = document;
    for (const nodeId of steps) {
      const host = (current.nodes || []).find((node: any) => node.id === nodeId);
      if (!host) {
        return this.orchestratorStore.raiseError(nodeId, {
          message: `There is no node ${nodeId} in ${current.properties ? current.properties.name : current.id}.`,
        }, "inside", undefined, current.id);
      }
      const inner = await graphOf(this, host);
      if (!inner || !Array.isArray(inner.nodes)) {
        return this.orchestratorStore.raiseError(nodeId, {
          message: `${(host.properties && host.properties.name) || nodeId} carries a graph this browser cannot find.`,
        }, "inside", undefined, current.id);
      }
      trail.push({
        nodeId,
        name: (host.properties && host.properties.name) || nodeId,
        graphId: String(inner.id),
      });
      current = inner;
    }
    // The document is kept so a deeper step resolves from where we are rather
    // than walking the whole chain again.
    this.insideInstance = {
      hostDocumentId: this.insideInstance ? this.insideInstance.hostDocumentId : this.graph.id,
      hostName: this.insideInstance ? this.insideInstance.hostName : (this.graph.properties && this.graph.properties.name) || this.graph.id,
      path: (this.insideInstance ? this.insideInstance.path : []).concat(steps),
      trail: (this.insideInstance ? this.insideInstance.trail : []).concat(trail),
      graphId: String(current.id),
      graphUrl: current.url || String(current.id),
      name: (current.properties && current.properties.name) || String(current.id),
      document: current,
    };
    this.graphSnapshot = patchInto(this.graphSnapshot, current);
    this.graph = patchInto(this.graph, current);
    this.graphSnapshotStore.graph = patchInto(this.graphSnapshotStore.graph, current);
    return this.insideInstance;
  },

  /** Step back out to the document that was open, exactly as rewind does. */
  leaveInstance() {
    if (!this.insideInstance) {
      return null;
    }
    this.insideInstance = null;
    if (!this.crdtSession) {
      return null;
    }
    const projection = this.crdtSession.projection();
    if (!projection) {
      return null;
    }
    this.graphSnapshot = patchInto(this.graphSnapshot, projection);
    this.graph = patchInto(this.graph, projection);
    this.graphSnapshotStore.graph = patchInto(this.graphSnapshotStore.graph, projection);
    return null;
  },
} as ThisType<any>;
