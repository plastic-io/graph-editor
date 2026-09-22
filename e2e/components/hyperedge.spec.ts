import { test, expect } from "@playwright/test";
import { graphId, openGraph, pointAtDevServer, SERVER, stateOf } from "../hybrid/harness";
import { buildComponent, buildHost, importedNode, observed, publish, runHere, runThere } from "./harness";

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
 * What each turn is, in order of depth.  The outermost use of the component is
 * **flattened** — the import is resolved before anything runs, so its nodes are
 * the host's, named by the host they came through.  The link inside it is the
 * component within itself, which flattening cannot resolve and will not guess
 * at, so every turn below is a **call**, named by the path it was reached
 * through.  Both domains have to say the same thing.
 */
const FLATTENED = ["left/echo", "right/echo"];
const CALLED = ["left/call", "left/call/call", "right/call", "right/call/call"];

test.describe("a published graph, imported by reference", () => {
  test("the server runs every turn, each its own, and what leaves by the published edge comes back", async ({ browser }) => {
    const { page, context, componentId, hostId } = await scene(browser, { embed: false });

    const summary = await runThere(hostId, "start", countdown);
    expect(summary.state).toBe("completed");
    expect(summary.errors).toBe(0);

    const visits = await observed(hostId, summary.executionId, "visit");
    // the hyperedge reached both imports, and each is its own set of nodes
    expect(visits.filter((v: any) => !v.path).map((v: any) => v.node).sort()).toEqual(FLATTENED);
    // and every turn below is a call of its own, with scratch of its own
    expect(visits.filter((v: any) => v.path).map((v: any) => v.path).sort()).toEqual(CALLED);
    expect(visits.filter((v: any) => v.path).every((v: any) => v.mine === 1)).toBe(true);
    // the countdown is the graph's business, and it stopped itself
    expect(visits.filter((v: any) => v.node === "left/echo").map((v: any) => v.n)).toEqual([2]);
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
    expect(visits.filter((v: any) => !v.path).map((v: any) => v.node).sort()).toEqual(FLATTENED);
    expect(visits.filter((v: any) => v.path).map((v: any) => v.path).sort()).toEqual(CALLED);
    expect(visits.filter((v: any) => v.path).every((v: any) => v.mine === 1)).toBe(true);
    expect((state.done || []).length).toBe(2);

    // and what this browser did is in the server's own store, where an
    // execution of either domain is looked up the same way (plan §4.5.3)
    const kept = await observed(hostId, executionId, "visit");
    expect(kept.filter((v: any) => v.path).map((v: any) => v.path).sort()).toEqual(CALLED);

    // a node that draws nothing draws nothing: no template is not an error
    expect(await page.locator("text=Cannot read properties of null").count()).toBe(0);

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
    const { context, hostId } = await scene(browser, { embed: true });

    const summary = await runThere(hostId, "start", countdown);
    expect(summary.state).toBe("completed");
    expect(summary.errors).toBe(0);

    const visits = await observed(hostId, summary.executionId, "visit");
    expect(visits.filter((v: any) => !v.path).map((v: any) => v.node).sort()).toEqual(FLATTENED);
    expect(visits.filter((v: any) => v.path).map((v: any) => v.path).sort()).toEqual(CALLED);
    expect(visits.filter((v: any) => v.path).every((v: any) => v.mine === 1)).toBe(true);
    const done = await observed(hostId, summary.executionId, "done");
    expect(done).toHaveLength(2);

    await context.close();
  });
});

/** A component published at version 1, and a host importing it twice. */
async function scene(browser: any, options: { embed: boolean }) {
  const componentId = graphId();
  const hostId = graphId();
  const context = await browser.newContext();
  await pointAtDevServer(context);
  const page = await context.newPage();

  await openGraph(page, componentId);
  await buildComponent(page, componentId);
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
