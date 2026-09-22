import { test, expect } from "@playwright/test";
import { graphId, openGraph, pointAtDevServer, SERVER, stateOf } from "../hybrid/harness";
import { buildComponent, buildHost, executionErrors, importedNode, observed, pageErrors, publish, routedTo, runHere, runThere } from "./harness";

/**
 * A published graph, imported, with a hyperedge, calling itself.
 *
 * Everything this milestone taught the scheduler, in one graph, in the shape a
 * person would build it:
 *
 *   - a graph is **published** as a component, and what crosses its boundary is
 *     the ports it marked external — its published edges;
 *   - another graph **imports** it twice, which is two uses that must share
 *     nothing;
 *   - a value leaves one field on **two connectors at once** — a hyperedge —
 *     in the host and again inside the component;
 *   - and inside the component a node carries **that same published component**,
 *     so running it is recursion through the registry: each turn loaded at the
 *     moment of the call, with state of its own, stopping when the graph says.
 *
 * Both domains run the same scheduler, so both are asked the same questions.
 */

const countdown = { n: 2, tag: "t" };

/**
 * Every turn, named by the path of hosts it was reached through.  All of them
 * are calls: an import is a call the same way the component within itself is
 * (D-38), so one import means one thing however deep it is and whichever domain
 * runs it.  Both domains have to say exactly this.
 */
const TURNS = [
  "left", "left/call", "left/call/call",
  "right", "right/call", "right/call/call",
];

test.describe("a published graph, imported by reference", () => {
  test("the server runs every turn, each its own, and what leaves by the published edge comes back", async ({ browser }) => {
    const { page, context, componentId, hostId } = await scene(browser, { embed: false });

    const summary = await runThere(hostId, "start", countdown);
    expect(summary.state).toBe("completed");
    expect(summary.errors).toBe(0);
    // nothing was recorded as having gone wrong, by name, before anything else
    expect(await executionErrors(hostId, summary.executionId)).toEqual([]);

    const visits = await observed(hostId, summary.executionId, "visit");
    // the hyperedge reached both imports, and every turn is a call of its own
    expect(visits.map((v: any) => v.path).sort()).toEqual([...TURNS].sort());
    // each with scratch of its own, counting exactly the one visit it had
    expect(visits.every((v: any) => v.mine === 1)).toBe(true);
    // the countdown is the graph's business, and it stopped itself
    expect(visits.filter((v: any) => v.path === "left").map((v: any) => v.n)).toEqual([2]);
    expect(visits.filter((v: any) => v.path === "left/call/call").map((v: any) => v.n)).toEqual([0]);
    // what left each import by its published output reached the host's one node
    // what left each import by its published output reached the host's one node
    const done = await observed(hostId, summary.executionId, "done");
    expect(done).toHaveLength(2);
    expect(done.map((d: any) => d.n)).toEqual([2, 2]);

    await context.close();
  });

  test("the browser runs the same graph the same way, and the server keeps what it did", async ({ browser }) => {
    const { page, context, hostId } = await scene(browser, { embed: false });

    const executionId = await runHere(page, "start", countdown);
    await page.waitForTimeout(4000);
    const state = await stateOf(page);
    const visits = (state.visits || []) as any[];
    expect(visits.map((v: any) => v.path).sort()).toEqual([...TURNS].sort());
    expect(visits.every((v: any) => v.mine === 1)).toBe(true);
    expect((state.done || []).length).toBe(2);

    // and what this browser did is in the server's own store, where an
    // execution of either domain is looked up the same way (plan §4.5.3)
    const kept = await observed(hostId, executionId, "visit");
    expect(kept.map((v: any) => v.path).sort()).toEqual([...TURNS].sort());

    // and nothing anywhere said it went wrong: not the execution, not the
    // page the errors are piped to, not a node's template
    expect(await executionErrors(hostId, executionId)).toEqual([]);
    expect(await pageErrors(page)).toEqual([]);
    expect(await page.locator("text=Cannot read properties of null").count()).toBe(0);
    expect(await page.locator("text=At least one <template> or <script> is required").count()).toBe(0);

    await context.close();
  });
});

test.describe("a published graph, imported the way the editor imports one", () => {
  /**
   * An import carries a copy of what it imported.  That copy is something
   * flattening *could* resolve, and for a while it did — which quietly made
   * the same graph two different programs: inlined nodes here, calls with
   * state of their own there, depending on which domain happened to hold a
   * copy.  A runtime that can make a call is given the link either way now,
   * so the arrangement people will actually have answers the same as the one
   * the tests build.
   */
  test("answers exactly as the same component imported by reference does", async ({ browser }) => {
    const { page, context, hostId } = await scene(browser, { embed: true });

    const summary = await runThere(hostId, "start", countdown);
    expect(summary.state).toBe("completed");
    expect(summary.errors).toBe(0);
    expect(await executionErrors(hostId, summary.executionId)).toEqual([]);

    const visits = await observed(hostId, summary.executionId, "visit");
    expect(visits.map((v: any) => v.path).sort()).toEqual([...TURNS].sort());
    expect(visits.every((v: any) => v.mine === 1)).toBe(true);
    const done = await observed(hostId, summary.executionId, "done");
    expect(done).toHaveLength(2);
    expect(await pageErrors(page)).toEqual([]);

    await context.close();
  });
});

test.describe("a node inside a call, placed in the other domain", () => {
  /**
   * The case that says whether calls can go all the way down.  A hop the server
   * hands to the browsers is addressed by a node id, and inside a call that id
   * is the component author's — `draw`, in both copies, at every depth.  Only
   * the pair (path, id) says which one, so the hop carries the path and the
   * browser enters that call to answer it.  While an import was flattened
   * before anything ran, the flat id did this job and a call could not be
   * reached from outside at all (D-38).
   */
  test("the hop comes back to the call it belongs to, and the browser answers it there", async ({ browser }) => {
    const { page, context, hostId } = await scene(browser, { embed: false, drawsInTheBrowser: true });

    const summary = await runThere(hostId, "start", countdown);
    expect(summary.state).toBe("completed");
    expect(summary.errors).toBe(0);

    // the server ran what it could and handed `draw` to the browsers once per
    // turn, each hop naming the call it belongs to — the same node id six times
    expect(await routedTo(hostId, summary.executionId, "draw")).toHaveLength(6);
    expect([...(await routedTo(hostId, summary.executionId, "draw"))].sort()).toEqual([...TURNS].sort());

    // and this page, which is watching, ran each of them in the call it was
    // addressed to rather than in whichever copy it found first
    await page.waitForTimeout(4000);
    const state = await stateOf(page);
    expect((state.drawn || []).map((d: any) => d.path).sort()).toEqual([...TURNS].sort());
    expect((state.drawn || []).every((d: any) => d.node === "draw")).toBe(true);
    expect(await pageErrors(page)).toEqual([]);

    await context.close();
  });
});

/** A component published at version 1, and a host importing it twice. */
async function scene(browser: any, options: { embed: boolean; drawsInTheBrowser?: boolean }) {
  const componentId = graphId();
  const hostId = graphId();
  const context = await browser.newContext();
  await pointAtDevServer(context);
  const page = await context.newPage();

  await openGraph(page, componentId);
  await buildComponent(page, componentId, { drawsInTheBrowser: options.drawsInTheBrowser });
  const manifest = await publish(componentId);
  if (manifest.version !== 1) {
    throw new Error(`expected the first publish to be version 1, got ${manifest.version}`);
  }
  const published = await (await fetch(`${SERVER}/components/${componentId}/1`)).json();
  const artifact = options.embed ? published.artifact : null;

  await openGraph(page, hostId);
  await buildHost(page, hostId, [
    importedNode("left", componentId, 1, artifact, manifest),
    importedNode("right", componentId, 1, artifact, manifest),
  ]);
  return { page, context, componentId, hostId, manifest };
}
