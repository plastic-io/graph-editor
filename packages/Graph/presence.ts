import { useStore as useOrchestratorStore } from "@plastic-io/graph-editor-vue3-orchestrator";

/**
 * Where everyone's pointer and selection are.
 *
 * Presence rides the CRDT awareness channel rather than the document: it is
 * never stored, never merged into the graph, and disappears when a person
 * closes the tab.
 */
export default {
  presenceProvider() {
    const orchestrator = useOrchestratorStore();
    return (
      orchestrator.syncProviders.find(
        (provider: any) => typeof provider.setPresence === "function",
      ) || null
    );
  },

  /** Tell everyone else where this user is looking. */
  publishPresence(
    cursor: { x: number; y: number } | null,
    selection?: { nodes: string[]; connectors: string[] },
  ) {
    const provider = this.presenceProvider();
    if (!provider) {
      return;
    }
    provider.setPresence(cursor, selection);
  },
} as ThisType<any>;
