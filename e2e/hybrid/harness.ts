import type { BrowserContext, Page } from "@playwright/test";

/**
 * What the two-browser tests need: an editor pointed at the local server, a
 * graph with a node in each domain, and the few server calls that stand in
 * for what only the deployed server does (handing a hop to the browsers, and
 * the five-minute tick).
 */

export const SERVER = "http://localhost:3030";
export const EDITOR = "http://localhost:4188/graph-editor";

/** A ULID-shaped execution id; the server refuses anything else. */
export function executionId(suffix = ""): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let out = "01M34";
  while (out.length < 26 - suffix.length) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out + suffix;
}

export function graphId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const run = (n: number) => Array.from({ length: n }, hex).join("");
  return `${run(8)}-${run(4)}-4${run(3)}-a${run(3)}-${run(12)}`;
}

/**
 * The editor keeps where its server is in its own preferences, and an http
 * server has no authorizer, so pointing a fresh browser at the dev server is
 * all it takes to open a graph without signing in.
 */
export async function pointAtDevServer(context: BrowserContext) {
  await context.addInitScript((server: string) => {
    const preferences = {
      userName: "Playwright",
      email: "",
      userId: "0",
      avatar: "",
      workstationId: "playwright",
      graphHTTPServer: server + "/",
      graphWSSServer: server.replace(/^http/, "ws") + "/",
      remoteConfiguration: "",
      useLocalStorage: false,
      showMap: false,
      showLabels: true,
      newNodeHelp: false,
    };
    try {
      window.localStorage.setItem("plastic-user-preferences", JSON.stringify(preferences));
    } catch (err) {
      /* a context without storage is not one these tests can use */
    }
  }, SERVER);
}

/** Open a graph and wait until the editor has it. */
export async function openGraph(page: Page, id: string) {
  await page.goto(`${EDITOR}/${id}`);
  await page.waitForFunction(() => {
    const app: any = document.querySelector("#app");
    const pinia = app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$pinia;
    return !!(pinia && pinia.state.value.graph && pinia.state.value.graph.graphSnapshot);
  }, undefined, { timeout: 60000 });
}

/** The session this page is, which is what a delivery can be addressed to. */
export function sessionOf(page: Page): Promise<string> {
  return page.evaluate(() => {
    const app: any = document.querySelector("#app");
    return app.__vue_app__.config.globalProperties.$pinia.state.value.orchestrator.sessionId;
  });
}

/**
 * What the worker wrote to the graph's shared state, which is how a test sees
 * a node run.  The scheduler's `state` is the worker's proxy itself, so a node
 * writing `state.drawn` lands beside `nodes`, not under a `state` key.
 */
export function stateOf(page: Page): Promise<any> {
  return page.evaluate(() => {
    const app: any = document.querySelector("#app");
    const proxy = app.__vue_app__.config.globalProperties.$pinia.state.value.orchestrator.webWorkerProxy;
    const { nodes, state, ...rest } = JSON.parse(JSON.stringify(proxy || {}));
    return { ...(state || {}), ...rest };
  });
}

/**
 * Ask this session to pick up what is waiting for it, the way connecting does.
 * Answers with how many deliveries it was given.
 */
export function resume(page: Page, id: string): Promise<number> {
  return page.evaluate(async (graph: string) => {
    const app: any = document.querySelector("#app");
    const orchestrator: any = app.__vue_app__.config.globalProperties.$pinia._s.get("orchestrator");
    return await orchestrator.resumeDeliveries(graph);
  }, id);
}

/**
 * A graph with a node in each domain: an entry point, a node that only draws
 * (so every viewer runs it), and one placed on the server.
 */
export async function buildHybridGraph(page: Page) {
  await page.evaluate(async () => {
    const app: any = document.querySelector("#app");
    const pinia = app.__vue_app__.config.globalProperties.$pinia;
    const graph = pinia._s.get("graph");
    const port = (name: string) => ({ name, type: "Object", external: false, visible: true });
    const node = (id: string, set: string, properties: Record<string, any>) => ({
      id,
      url: id,
      edges: [{ field: "out", connectors: [] as any[] }],
      version: 0,
      graphId: graph.graphSnapshot.id,
      artifact: null,
      data: null,
      properties: {
        inputs: [port("in")],
        outputs: [port("out")],
        groups: [],
        name: id,
        description: "",
        createdOn: Date.now(),
        lastUpdate: Date.now(),
        tags: [],
        icon: "mdi-node-rectangle",
        positionAbsolute: false,
        appearsInPresentation: false,
        appearsInExport: false,
        x: 0,
        y: 0,
        z: 0,
        presentation: { x: 0, y: 0, z: 0, order: 0 },
        ...properties,
      },
      template: { set, vue: "" },
    });
    graph.graphSnapshot.nodes.push(node("entry", "edges.out = value;", {}));
    graph.graphSnapshot.nodes.push(node("draw", "state.drawn = (state.drawn || 0) + 1; state.lastDrawn = value;", { placement: "browser" }));
    graph.graphSnapshot.nodes.push(node("charge", "state.charged = (state.charged || 0) + 1; state.lastCharge = value;", { placement: "browser", deliveryTarget: "initiator" }));
    graph.graphSnapshot.nodes.push(node("compute", "edges.out = {doubled: value.n * 2, ranOn: 'server'};", { placement: "server" }));
    graph.graphSnapshot.properties.name = "Playwright hybrid";
    await graph.updateGraphFromSnapshot("Build the hybrid graph");
  });
  await page.waitForTimeout(1500);
}

/* ------------------------------------------------------------------ *
 * the server, asked directly
 * ------------------------------------------------------------------ */

async function json(url: string, init?: any) {
  const response = await fetch(url, init);
  const text = await response.text();
  try {
    return { code: response.status, body: JSON.parse(text) };
  } catch (err) {
    return { code: response.status, body: text };
  }
}

/** Hand a hop to the browsers, as a server-owned execution would. */
export function park(graph: string, delivery: Record<string, any>, ttlMs?: number) {
  return json(`${SERVER}/debug/park`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ graphId: graph, ttlMs, delivery }),
  });
}

/** The five-minute tick, asked for now. */
export function sweep() {
  return json(`${SERVER}/debug/sweep`, { method: "POST" });
}

export function pending(graph: string, session?: string) {
  const query = session ? `?session=${encodeURIComponent(session)}` : "";
  return json(`${SERVER}/crdt/${graph}/deliveries/pending${query}`);
}

export function storeKeys() {
  return json(`${SERVER}/debug/keys`);
}

/** One parked record, read from the store the way a person debugging would. */
export async function parkedRecord(graph: string, execution: string, key: string) {
  const answer = await json(`${SERVER}/debug/object?key=${encodeURIComponent(`deliveries/pending/${graph}/${execution}/${key}.json`)}`);
  return answer.body;
}

/** The envelope a server-owned execution would send. */
export function delivery(graph: string, over: Record<string, any> = {}) {
  const id = over.executionId || executionId();
  return {
    schemaVersion: 1,
    executionId: id,
    correlationId: id,
    revisionId: "live",
    graphId: graph,
    nodeId: "draw",
    field: "in",
    value: { n: 21 },
    seq: 1,
    instancePath: [],
    target: "all-viewers",
    ...over,
  };
}
