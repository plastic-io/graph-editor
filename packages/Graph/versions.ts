import patchInto from "./project";
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

  async activateVersion(revision: any) {
    const provider = this.versionsProvider();
    if (!provider || !this.crdtSession || !revision) {
      return null;
    }
    return provider.activateRevision(this.crdtSession.graphId, revision.revisionId);
  },
} as ThisType<any>;
