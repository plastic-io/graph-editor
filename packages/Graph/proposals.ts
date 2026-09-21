import patchInto from "./project";
import { useStore as useOrchestratorStore } from "@plastic-io/graph-editor-vue3-orchestrator";

/**
 * Proposals (plan §4.7.2): an agent's change, held by the server until a human
 * commits it through the same admission path as every edit.  The editor
 * previews the graph as it would be, highlights what the proposal touches,
 * and commits or rejects.
 */
export default {
  proposalsProvider() {
    const orchestrator = useOrchestratorStore();
    return orchestrator.syncProviders.find((p: any) => typeof p.listProposals === "function") || null;
  },

  async listProposals() {
    const provider = this.proposalsProvider();
    if (!provider || !this.crdtSession) {
      return { proposals: [] };
    }
    return provider.listProposals(this.crdtSession.graphId);
  },

  /** Show the graph as the proposal would leave it, and mark what it touches. */
  async previewProposal(proposal: any) {
    const provider = this.proposalsProvider();
    if (!provider || !this.crdtSession || !proposal) {
      return null;
    }
    const { projection, proposal: full } = await provider.proposal(this.crdtSession.graphId, proposal.proposalId);
    if (!projection) {
      return null;
    }
    this.inRewindMode = true;
    this.graphSnapshot = patchInto(this.graphSnapshot, projection);
    this.graph = patchInto(this.graph, projection);
    this.graphSnapshotStore.graph = patchInto(this.graphSnapshotStore.graph, projection);
    const ops = (full && full.diffSummary && full.diffSummary.ops) || [];
    const touched = new Set<string>();
    const added: any[] = [];
    const removed: any[] = [];
    ops.forEach((op: any) => {
      if (op.nodeId) touched.add(op.nodeId);
      if (op.connector) {
        if (op.op === "connect") added.push({ id: op.connector.connectorId });
        if (op.op === "disconnect") removed.push({ id: op.connector.connectorId });
        touched.add(op.connector.to.nodeId);
      }
    });
    this.watchConnectors = added;
    this.errorConnectors = removed;
    this.selectedNodes = (projection.nodes || []).filter((n: any) => touched.has(n.id));
    return projection;
  },

  async leaveProposalPreview() {
    this.watchConnectors = [];
    this.errorConnectors = [];
    this.selectedNodes = [];
    await this.exitRewind();
  },

  async validateProposal(proposal: any, rebase = false) {
    const provider = this.proposalsProvider();
    if (!provider || !this.crdtSession || !proposal) {
      return null;
    }
    return provider.validateProposal(this.crdtSession.graphId, proposal.proposalId, rebase);
  },

  /** The server admits the proposal's bytes as this user; the change arrives like anyone else's. */
  async commitProposal(proposal: any) {
    const provider = this.proposalsProvider();
    if (!provider || !this.crdtSession || !proposal) {
      return null;
    }
    if (this.inRewindMode) {
      await this.leaveProposalPreview();
    }
    return provider.commitProposal(this.crdtSession.graphId, proposal.proposalId);
  },

  async decideProposal(proposal: any, decision: "approve" | "reject", rationale = "") {
    const provider = this.proposalsProvider();
    if (!provider || !this.crdtSession || !proposal) {
      return null;
    }
    if (this.inRewindMode) {
      await this.leaveProposalPreview();
    }
    return provider.decideProposal(this.crdtSession.graphId, proposal.proposalId, decision, proposal.proposalDigest, rationale);
  },

  /** The newest audit records of the open graph (what agents and the server did). */
  async agentActivity(limit = 50) {
    const provider = this.proposalsProvider();
    if (!provider || !this.crdtSession) {
      return { records: [] };
    }
    return provider.auditRecords(this.crdtSession.graphId, limit);
  },
} as ThisType<any>;
