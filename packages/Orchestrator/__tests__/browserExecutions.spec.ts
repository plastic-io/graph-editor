import { describe, it, expect, vi } from "vitest";
import { BrowserExecutions } from "../browserExecutions";
import { shouldRunDelivery } from "../../GraphCrdt/placement";

/**
 * The browser's half of hybrid execution (plan §4.8.2).  These exercise the
 * rules a viewer applies on its own: whether a delivery is this session's to
 * run, whether it has already run it, and what happens when it reaches a node
 * that belongs to the server.
 */
const owner = { sub: "auth0|u1", kind: "human", tenant: "personal:auth0|u1" };
const make = (options: any = {}) => {
  const finished: any[] = [];
  const executions = new BrowserExecutions({
    graphId: "g1",
    revisionId: "01M32AAAAAAAAAAAAAAAAAAAAA",
    owner,
    onFinished: (report: any) => finished.push(report),
    ...options,
  });
  executions.setGraph({ nodes: [{ id: "a", properties: { inputs: [{ name: "in" }], outputs: [{ name: "out" }] } }] });
  return { executions, finished };
};
const nodeInterface = (over: any = {}) => ({
  node: { id: "compute", url: "compute", properties: { placement: "server", inputs: [{ name: "in" }], outputs: [{ name: "out" }] } },
  field: "in",
  value: { n: 21 },
  edges: {} as any,
  ...over,
});

describe("which deliveries a session runs", () => {
  it("runs what every viewer draws, and only the initiator runs what acts", () => {
    expect(shouldRunDelivery({ target: "all-viewers" }, "session-a")).toBe(true);
    expect(shouldRunDelivery({}, "session-a")).toBe(true);
    expect(shouldRunDelivery({ target: "initiator", initiator: "session-a" }, "session-a")).toBe(true);
    expect(shouldRunDelivery({ target: "initiator", initiator: "session-b" }, "session-a")).toBe(false);
    // the session that started it is gone: nobody here takes its place
    expect(shouldRunDelivery({ target: "initiator" }, "session-a")).toBe(false);
  });

  it("runs a delivery once, however many times it arrives", () => {
    const { executions } = make();
    const delivery = { executionId: "01M32BBBBBBBBBBBBBBBBBBBBB", connectorId: "c1", nodeId: "a", seq: 3 };
    expect(executions.seen(delivery)).toBe(false);
    expect(executions.seen(delivery)).toBe(true);
    expect(executions.seen({ ...delivery, seq: 4 })).toBe(false);
    expect(executions.seen({ ...delivery, executionId: "01M32CCCCCCCCCCCCCCCCCCCCC" })).toBe(false);
    // a delivery with no connector is named by its node
    expect(executions.seen({ executionId: "01M32BBBBBBBBBBBBBBBBBBBBB", nodeId: "a", seq: 9 })).toBe(false);
    expect(executions.seen({ executionId: "01M32BBBBBBBBBBBBBBBBBBBBB", nodeId: "a", seq: 9 })).toBe(true);
  });
});

describe("reaching a node that belongs to the server", () => {
  it("hands the value over and routes what comes back", async () => {
    const deliveries: any[] = [];
    const { executions } = make({
      deliverToServer: async (delivery: any) => {
        deliveries.push(delivery);
        return { outputs: [{ field: "out", value: { doubled: 42 } }, { field: "log", value: "ran on the server" }] };
      },
    });
    const ni = nodeInterface();
    await executions.handOff(ni, { executionId: "01M32BBBBBBBBBBBBBBBBBBBBB" });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      schemaVersion: 1, graphId: "g1", revisionId: "01M32AAAAAAAAAAAAAAAAAAAAA",
      executionId: "01M32BBBBBBBBBBBBBBBBBBBBB", nodeId: "compute", field: "in", value: { n: 21 }, seq: 1,
    });
    // what the server's node wrote continues routing here
    expect(ni.edges).toEqual({ out: { doubled: 42 }, log: "ran on the server" });
  });

  it("does not run the node locally when there is no way to reach the server", async () => {
    const { executions } = make();
    await expect(executions.handOff(nodeInterface(), { executionId: "01M32BBBBBBBBBBBBBBBBBBBBB" }))
      .rejects.toThrow(/runs on the server/);
  });

  it("refuses to send a value that cannot cross, and reports the server's error as the node's", async () => {
    const { executions } = make({ deliverToServer: async () => ({ outputs: [], error: "the server node refused" }) });
    const cyclic: any = {};
    cyclic.self = cyclic;
    await expect(executions.handOff(nodeInterface({ value: cyclic }), { executionId: "01M32BBBBBBBBBBBBBBBBBBBBB" }))
      .rejects.toThrow(/cannot cross a domain boundary/);
    await expect(executions.handOff(nodeInterface(), { executionId: "01M32BBBBBBBBBBBBBBBBBBBBB" }))
      .rejects.toThrow(/the server node refused/);
  });

  it("knows what this domain runs", () => {
    const { executions } = make();
    expect(executions.runsHere({ properties: { placement: "browser" } })).toBe(true);
    expect(executions.runsHere({ properties: {} })).toBe(true);
    expect(executions.runsHere({ properties: { placement: "server" } })).toBe(false);
    expect(executions.runsHere({ properties: { capabilities: ["secret:openai"] } })).toBe(false);
  });
});

describe("what a finished execution reports", () => {
  it("names the graph, the revision, the owner and the browser", () => {
    const { executions, finished } = make();
    const scheduler = { addEventListener: vi.fn() };
    void scheduler;
    executions.route("begin", { executionId: "01M32BBBBBBBBBBBBBBBBBBBBB", url: "a", field: "in" });
    executions.route("beginedge", { executionId: "01M32BBBBBBBBBBBBBBBBBBBBB", nodeId: "a", field: "in", value: 1 });
    executions.route("end", { executionId: "01M32BBBBBBBBBBBBBBBBBBBBB", state: "completed", hops: 2, errors: 0, duration: 12 });
    expect(finished).toHaveLength(1);
    expect(finished[0].record).toMatchObject({
      executionId: "01M32BBBBBBBBBBBBBBBBBBBBB", graphId: "g1", revisionId: "01M32AAAAAAAAAAAAAAAAAAAAA",
      domain: "browser", owner, entry: { nodeUrl: "a", field: "in" }, state: "completed", hops: 2, errors: 0,
    });
    expect(finished[0].observations.map((o: any) => o.kind)).toEqual(["exec.begin", "edge.input", "exec.end"]);
    expect(finished[0].record.observations.key).toMatch(/^observations\/g1\/\d{10}\/01M32BBBBBBBBBBBBBBBBBBBBB\.ndjson$/);
    // an event from an execution this manager never saw begin is not its business
    executions.route("beginedge", { executionId: "01M32ZZZZZZZZZZZZZZZZZZZZZ", nodeId: "a", field: "in", value: 1 });
    expect(finished).toHaveLength(1);
  });
});
