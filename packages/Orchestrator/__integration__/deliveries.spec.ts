import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useStore as useOrchestratorStore } from "../main";

/**
 * Taking a delivery, and picking up what was missed (plan §4.8.2, PB-072/073).
 *
 * The server keeps a hop it handed to the browsers until one takes it.  This
 * session says what it takes — so nothing records it as never taken — and asks
 * on connecting for the ones it was not here for.
 */
const EXECUTION = "01M32AAAAAAAAAAAAAAAAAAAAA";
const delivery = (over: any = {}) => ({
  schemaVersion: 1,
  executionId: EXECUTION,
  correlationId: EXECUTION,
  revisionId: "live",
  graphId: "g1",
  nodeId: "render",
  field: "in",
  value: { price: 42 },
  seq: 1,
  instancePath: [],
  target: "all-viewers",
  ...over,
});

/** A provider that answers like the server's parking routes. */
class FakeProvider {
  asked: { graphId: string; session: string }[] = [];
  claims: any[] = [];
  pending: any[] = [];
  failWith: Error | null = null;
  async pendingDeliveries(graphId: string, query: any = {}) {
    this.asked.push({ graphId, session: query.session });
    if (this.failWith) {
      throw this.failWith;
    }
    return { graphId, deliveries: this.pending, parked: this.pending.length };
  }
  async claimDelivery(graphId: string, body: any) {
    this.claims.push({ graphId, ...body });
    return { claimed: true };
  }
}

const setup = () => {
  setActivePinia(createPinia());
  const orchestrator: any = useOrchestratorStore();
  const posted: any[] = [];
  orchestrator.scheduleWorker = { postMessage: (message: any) => posted.push(message) };
  const provider = new FakeProvider();
  orchestrator.syncProviders = [provider as any];
  return { orchestrator, provider, posted };
};

describe("taking a delivery", () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it("hands it to the worker and tells the server this session took it", async () => {
    const { orchestrator, provider, posted } = setup();
    orchestrator.takeDelivery(delivery());
    expect(posted).toEqual([{ method: "deliver", args: [delivery()] }]);
    await Promise.resolve();
    expect(provider.claims).toEqual([{
      graphId: "g1", executionId: EXECUTION, key: "render-1", session: orchestrator.sessionId,
    }]);
  });

  it("names the delivery by its connector when it has one, which is what makes it one unit of work", async () => {
    const { orchestrator, provider } = setup();
    orchestrator.takeDelivery(delivery({ connectorId: "c7", seq: 3 }));
    await Promise.resolve();
    expect(provider.claims[0].key).toBe("c7-3");
  });

  it("still runs it when there is no server to tell", () => {
    setActivePinia(createPinia());
    const orchestrator: any = useOrchestratorStore();
    const posted: any[] = [];
    orchestrator.scheduleWorker = { postMessage: (message: any) => posted.push(message) };
    orchestrator.syncProviders = [];
    orchestrator.takeDelivery(delivery());
    expect(posted).toHaveLength(1);
  });
});

describe("picking up what this session missed", () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it("asks for this session's own waiting deliveries and takes them", async () => {
    const { orchestrator, provider, posted } = setup();
    provider.pending = [delivery(), delivery({ nodeId: "draw", seq: 2 })];
    const count = await orchestrator.resumeDeliveries("g1");
    expect(count).toBe(2);
    expect(provider.asked).toEqual([{ graphId: "g1", session: orchestrator.sessionId }]);
    expect(posted.map((p: any) => p.args[0].nodeId)).toEqual(["render", "draw"]);
    await Promise.resolve();
    expect(provider.claims.map((c: any) => c.key)).toEqual(["render-1", "draw-2"]);
  });

  it("leaves alone a delivery addressed to a session that is not this one", async () => {
    const { orchestrator, provider, posted } = setup();
    provider.pending = [
      delivery({ nodeId: "charge", seq: 1, target: "initiator", initiator: "another-session" }),
      delivery({ nodeId: "render", seq: 2 }),
    ];
    await orchestrator.resumeDeliveries("g1");
    expect(posted.map((p: any) => p.args[0].nodeId)).toEqual(["render"]);
  });

  it("takes what was addressed to this session while it was away", async () => {
    const { orchestrator, provider, posted } = setup();
    provider.pending = [delivery({ nodeId: "charge", target: "initiator", initiator: orchestrator.sessionId })];
    await orchestrator.resumeDeliveries("g1");
    expect(posted.map((p: any) => p.args[0].nodeId)).toEqual(["charge"]);
  });

  it("says nothing was missed when there is no server, and survives one that will not answer", async () => {
    const { orchestrator, provider } = setup();
    expect(await orchestrator.resumeDeliveries("")).toBe(0);
    provider.failWith = new Error("no");
    expect(await orchestrator.resumeDeliveries("g1")).toBe(0);
  });
});
