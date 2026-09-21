import { defineStore } from "pinia";

export type MutationState = "pending" | "accepted" | "rejected";
export interface TrackedMutation {
  mutationId: string;
  description: string;
  state: MutationState;
  at: number;
  updateId?: string;
  code?: string;
  reason?: string;
}

const KEEP_ACCEPTED = 20;

/** Changes the server refused, kept so the user can copy them back by hand. */
export interface Quarantine {
  at: number;
  reason: string;
  descriptions: string[];
  graph: any;
}

/** What the server has said about each local change (plan §4.4.4, PB-024 first half). */
export const useStore = defineStore("syncStatus", {
  state: () => ({
    mutations: {} as Record<string, TrackedMutation>,
    connected: false,
    quarantine: null as Quarantine | null,
  }),
  getters: {
    pending: (s) => Object.values(s.mutations).filter((m) => m.state === "pending"),
    rejected: (s) => Object.values(s.mutations).filter((m) => m.state === "rejected"),
    accepted: (s) => Object.values(s.mutations).filter((m) => m.state === "accepted"),
  },
  actions: {
    track(mutationId: string, description: string) {
      this.mutations[mutationId] = { mutationId, description, state: "pending", at: Date.now() };
    },
    accepted(mutationId: string, updateId?: string) {
      const m = this.mutations[mutationId];
      if (m) {
        m.state = "accepted";
        m.updateId = updateId;
      }
      // keep the list short: only the most recent acknowledged changes stay
      const done = Object.values(this.mutations).filter((x) => x.state === "accepted").sort((a, b) => b.at - a.at);
      done.slice(KEEP_ACCEPTED).forEach((x) => delete this.mutations[x.mutationId]);
    },
    rejected(mutationId: string, code: string, reason: string) {
      const m = this.mutations[mutationId] || { mutationId, description: "(unknown change)", at: Date.now(), state: "pending" as MutationState };
      m.state = "rejected";
      m.code = code;
      m.reason = reason;
      this.mutations[mutationId] = m;
    },
    dismissRejected() {
      Object.values(this.mutations).filter((m) => m.state === "rejected").forEach((m) => delete this.mutations[m.mutationId]);
    },
    dismiss(mutationIds: string[]) {
      mutationIds.forEach((id) => delete this.mutations[id]);
    },
    setQuarantine(q: Quarantine | null) {
      this.quarantine = q;
    },
    setConnected(connected: boolean) {
      this.connected = connected;
    },
  },
});
