import patchInto from "./project";
import { externalFields } from "./components";
import { ROOT_KEY } from "@plastic-io/graph-crdt";
import { useStore as useOrchestratorStore } from "@plastic-io/graph-editor-vue3-orchestrator";

/**
 * Named versions of the graph (plan §4.7), kept by the graph server as Yjs
 * snapshots of the document.  Rewind steps through every recorded action;
 * versions are the points someone chose to name, and the one execution runs.
 */
export default {
  /** The sync provider that keeps versions (the server one). */
  versionsProvider() {
    const orchestrator = useOrchestratorStore();
    return orchestrator.syncProviders.find((p: any) => typeof p.listRevisions === "function") || null;
  },

  /** Which version the open document carries, stamped by the server at the last cut. */
  currentVersion() {
    if (!this.crdtSession) {
      return null;
    }
    const meta = this.crdtSession.doc.getMap(ROOT_KEY).get("meta");
    const revision = meta && typeof meta.get === "function" ? meta.get("revision") : null;
    return revision || null;
  },

  async listVersions() {
    const provider = this.versionsProvider();
    if (!provider || !this.crdtSession) {
      return { revisions: [], head: null, active: null };
    }
    return provider.listRevisions(this.crdtSession.graphId);
  },

  async saveVersion(label: string) {
    const provider = this.versionsProvider();
    if (!provider || !this.crdtSession) {
      return null;
    }
    return provider.cutRevision(this.crdtSession.graphId, label);
  },

  /** Show a version without changing the document (leaves through exitRewind). */
  async previewVersion(revision: any) {
    const provider = this.versionsProvider();
    if (!provider || !this.crdtSession || !revision) {
      return null;
    }
    const { projection } = await provider.revision(this.crdtSession.graphId, revision.revisionId);
    if (!projection) {
      return null;
    }
    this.inRewindMode = true;
    this.graphSnapshot = patchInto(this.graphSnapshot, projection);
    this.graph = patchInto(this.graph, projection);
    this.graphSnapshotStore.graph = patchInto(this.graphSnapshotStore.graph, projection);
    return projection;
  },

  /** The server brings the live graph back to the version; the change arrives like anyone else's. */
  async restoreVersion(revision: any) {
    const provider = this.versionsProvider();
    if (!provider || !this.crdtSession || !revision) {
      return null;
    }
    if (this.inRewindMode) {
      await this.exitRewind();
    }
    return provider.restoreRevision(this.crdtSession.graphId, revision.revisionId);
  },

  /**
   * Publish the graph as a component at a revision (plan §4.3): the current
   * head, cut now if the graph changed, or an older revision by id.  The
   * published version number is the revision's sequence number.
   */
  async publishVersion(options: { label?: string; revisionId?: string } = {}) {
    const provider = this.versionsProvider();
    if (!provider || !this.crdtSession || typeof provider.publishGraph !== "function") {
      return null;
    }
    return provider.publishGraph(this.crdtSession.graphId, options);
  },

  /** Publish one node of the graph as a component; its version is the graph's revision. */
  async publishNodeVersion(nodeId: string, label = "") {
    const provider = this.versionsProvider();
    if (!provider || !this.crdtSession || typeof provider.publishGraph !== "function") {
      return null;
    }
    return provider.publishGraph(this.crdtSession.graphId, { nodeId, label });
  },

  /** Every published version of a component, newest first. */
  async componentVersions(publishedId: string) {
    const provider = this.versionsProvider();
    if (!provider || typeof provider.componentVersions !== "function") {
      return { versions: [], head: null };
    }
    return provider.componentVersions(publishedId);
  },

  /**
   * Move an imported node to another published version of its component: the
   * embedded copy, the pin, the ports and the edges follow the new artifact;
   * connectors stay on edges whose field still exists.
   */
  async upgradeComponent(nodeId: string, version: number | string) {
    const provider = this.versionsProvider();
    const node = this.graphSnapshot.nodes.find((n: any) => n.id === nodeId);
    if (!provider || !node || typeof provider.component !== "function") {
      return null;
    }
    const pin = node.properties.component;
    const publishedId = pin ? pin.publishedId : (node.linkedGraph ? node.linkedGraph.id : null);
    if (!publishedId) {
      throw new Error("This node is not pinned to a published component.");
    }
    const { manifest, artifact } = await provider.component(publishedId, version);
    if (!manifest || !artifact) {
      throw new Error(`Version ${version} of ${publishedId} is not published.`);
    }
    const item = { ...artifact };
    delete item.artifact;
    delete item.url;
    const keepConnectors: Record<string, any[]> = {};
    (node.edges || []).forEach((edge: any) => { keepConnectors[edge.field] = edge.connectors || []; });
    if (manifest.kind === "graph") {
      const fields = externalFields(item);
      node.linkedGraph = { ...(node.linkedGraph || { data: {}, properties: {} }), id: publishedId, version: manifest.version, revisionId: manifest.provenance && manifest.provenance.fromGraph && manifest.provenance.fromGraph.revisionId, graph: item, loaded: true, fields };
      node.properties.inputs = Object.keys(fields.inputs).map((k) => ({ name: fields.inputs[k].field, external: false, visible: true, type: fields.inputs[k].type }));
      node.properties.outputs = Object.keys(fields.outputs).map((k) => ({ name: fields.outputs[k].field, visible: true, external: false }));
      node.edges = Object.keys(fields.outputs).map((k) => ({ field: fields.outputs[k].field, connectors: keepConnectors[fields.outputs[k].field] || [], type: fields.outputs[k].type }));
    } else {
      item.loaded = true;
      (item.edges || []).forEach((edge: any) => { edge.connectors = []; });
      node.linkedNode = item;
      node.template = { set: item.template.set, vue: item.template.vue };
      node.properties.inputs = item.properties.inputs;
      node.properties.outputs = item.properties.outputs;
      node.edges = (item.edges || []).map((edge: any) => ({ ...edge, connectors: keepConnectors[edge.field] || [] }));
      node.data = item.data;
    }
    node.artifact = `artifacts/${publishedId}.${manifest.version}`;
    node.properties.component = { publishedId, version: manifest.version, digest: manifest.digest };
    const dropped = Object.keys(keepConnectors).filter((field) => !(node.edges || []).some((e: any) => e.field === field) && keepConnectors[field].length);
    this.updateGraphFromSnapshot(`Upgrade ${manifest.name} to v${manifest.version}`);
    return { manifest, droppedEdges: dropped };
  },

  async activateVersion(revision: any) {
    const provider = this.versionsProvider();
    if (!provider || !this.crdtSession || !revision) {
      return null;
    }
    return provider.activateRevision(this.crdtSession.graphId, revision.revisionId);
  },
} as ThisType<any>;
