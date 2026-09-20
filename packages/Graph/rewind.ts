import { projectUpdates } from "./crdt";
import patchInto from "./project";
import { useStore as useOrchestratorStore } from "@plastic-io/graph-editor-vue3-orchestrator";

/**
 * Rewind, rebuilt on the CRDT update log.
 *
 * The pre-CRDT version needed a full JSON projection of the graph written to
 * storage for every single edit.  Replaying a prefix of the update log into a
 * throwaway document gets the same answer from data the sync layer already
 * keeps, and committing a revert becomes an ordinary edit, which means it
 * merges with whatever other people did in the meantime and can itself be
 * undone.
 */
export default {
  /**
   * The attached provider whose log is most complete.  The server's log holds
   * everything anyone did; a browser's holds only what that browser saw, so it
   * is used when there is no server.
   */
  rewindProvider() {
    const orchestrator = useOrchestratorStore();
    const candidates = orchestrator.syncProviders.filter(
      (provider: any) =>
        typeof provider.history === "function" &&
        typeof provider.updatesFor === "function",
    );
    if (candidates.length === 0) {
      return null;
    }
    return candidates
      .slice()
      .sort((a: any, b: any) => (b.historyPriority || 0) - (a.historyPriority || 0))[0];
  },

  /** Every recorded action for the open graph, oldest first. */
  async listRewindHistory() {
    const provider = this.rewindProvider();
    if (!provider || !this.crdtSession) {
      return [];
    }
    try {
      return await provider.history(this.crdtSession.graphId);
    } catch (err) {
      console.error("Cannot read the graph history.", err);
      return [];
    }
  },

  /** The graph as it stood immediately after the given history entry. */
  async projectRewind(entry: any) {
    const provider = this.rewindProvider();
    if (!provider || !this.crdtSession || !entry) {
      return null;
    }
    const updates = await provider.updatesFor(this.crdtSession.graphId, entry);
    if (!updates || updates.length === 0) {
      return null;
    }
    return projectUpdates(updates);
  },

  /** Show a past state without changing the document. */
  async previewRewind(entry: any) {
    const graph = await this.projectRewind(entry);
    if (!graph) {
      return null;
    }
    this.inRewindMode = true;
    this.graphSnapshot = patchInto(this.graphSnapshot, graph);
    this.graph = patchInto(this.graph, graph);
    this.graphSnapshotStore.graph = patchInto(this.graphSnapshotStore.graph, graph);
    return graph;
  },

  /** Adopt the previewed state as the current one. */
  async commitRewind(entry: any) {
    const graph = await this.projectRewind(entry);
    this.inRewindMode = false;
    if (!graph) {
      return;
    }
    this.graphSnapshot = patchInto(this.graphSnapshot, graph);
    this.updateGraphFromSnapshot("Revert");
  },

  /** Leave rewind without keeping anything. */
  async exitRewind() {
    this.inRewindMode = false;
    if (!this.crdtSession) {
      return;
    }
    const projection = this.crdtSession.projection();
    if (!projection) {
      return;
    }
    this.graphSnapshot = patchInto(this.graphSnapshot, projection);
    this.graph = patchInto(this.graph, projection);
    this.graphSnapshotStore.graph = patchInto(this.graphSnapshotStore.graph, projection);
  },
} as ThisType<any>;
