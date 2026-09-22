import { test, expect } from "@playwright/test";
import {
  buildHybridGraph, delivery, executionId, graphId, openGraph, park, parkedRecord,
  pending, pointAtDevServer, resume, sessionOf, stateOf, sweep,
} from "./harness";
import { pageErrors } from "../components/harness";

/**
 * Two people watching the same graph (plan §8.1.5, PB-104).
 *
 * A hop the server hands to "the browsers" means something different to each
 * of them: a node that only draws is drawn by every viewer, one that acts is
 * the initiator's alone, and one nobody takes has to end as something a person
 * can read.  None of that is answerable in a single page, so these run two.
 *
 * A session is a page load, so these ask a page to pick up what is waiting
 * rather than reloading it — a reload would be a different session, which is
 * a different question.  The one test that is about coming back does reload,
 * and asks the question that survives it.
 */
test.describe("a hop handed to the browsers", () => {
  test("a node that only draws is drawn by every viewer, and each says it took it", async ({ browser }) => {
    const id = graphId();
    const first = await browser.newContext();
    const second = await browser.newContext();
    await pointAtDevServer(first);
    await pointAtDevServer(second);
    const pageA = await first.newPage();
    const pageB = await second.newPage();

    await openGraph(pageA, id);
    await buildHybridGraph(pageA);
    await openGraph(pageB, id);
    await pageB.waitForTimeout(1500);

    const execution = executionId();
    await park(id, delivery(id, { executionId: execution, nodeId: "draw", target: "all-viewers" }));

    expect(await resume(pageA, id)).toBe(1);
    expect(await resume(pageB, id)).toBe(1);
    await pageA.waitForTimeout(2000);
    await pageB.waitForTimeout(2000);

    expect((await stateOf(pageA)).drawn).toBe(1);
    expect((await stateOf(pageB)).drawn).toBe(1);

    const record = await parkedRecord(id, execution, "draw-1");
    expect(record.state).toBe("claimed");
    expect(record.runs).toHaveLength(2);
    expect(new Set(record.runs.map((run: any) => run.session)).size).toBe(2);

    // and neither is offered it again
    expect(await resume(pageA, id)).toBe(0);
    expect(await resume(pageB, id)).toBe(0);
    expect((await stateOf(pageA)).drawn).toBe(1);

    // and neither page was told anything went wrong
    expect(await pageErrors(pageA)).toEqual([]);
    expect(await pageErrors(pageB)).toEqual([]);

    await first.close();
    await second.close();
  });

  test("a node that acts is the initiator's alone, and the other viewer is never offered it", async ({ browser }) => {
    const id = graphId();
    const first = await browser.newContext();
    const second = await browser.newContext();
    await pointAtDevServer(first);
    await pointAtDevServer(second);
    const pageA = await first.newPage();
    const pageB = await second.newPage();

    await openGraph(pageA, id);
    await buildHybridGraph(pageA);
    await openGraph(pageB, id);
    await pageB.waitForTimeout(1500);

    const initiator = await sessionOf(pageA);
    const other = await sessionOf(pageB);
    expect(initiator).not.toBe(other);
    const execution = executionId();
    await park(id, delivery(id, { executionId: execution, nodeId: "charge", seq: 2, target: "initiator", initiator }));

    // the server answers each session with what that session would run
    expect((await pending(id, initiator)).body.deliveries.map((d: any) => d.nodeId)).toEqual(["charge"]);
    expect((await pending(id, other)).body.deliveries).toEqual([]);

    expect(await resume(pageB, id)).toBe(0);
    await pageB.waitForTimeout(1500);
    expect((await stateOf(pageB)).charged).toBeUndefined();

    expect(await resume(pageA, id)).toBe(1);
    await pageA.waitForTimeout(2000);
    expect((await stateOf(pageA)).charged).toBe(1);
    expect((await stateOf(pageB)).charged).toBeUndefined();

    const record = await parkedRecord(id, execution, "charge-2");
    expect(record.state).toBe("claimed");
    expect(record.runs).toHaveLength(1);
    expect(record.runs[0].session).toBe(initiator);

    expect(await pageErrors(pageA)).toEqual([]);
    expect(await pageErrors(pageB)).toEqual([]);

    await first.close();
    await second.close();
  });

  test("what waited while a browser was away is run when it comes back, once per viewer", async ({ browser }) => {
    const id = graphId();
    const context = await browser.newContext();
    await pointAtDevServer(context);
    const page = await context.newPage();

    await openGraph(page, id);
    await buildHybridGraph(page);

    // the browser leaves, and a hop arrives while nobody is here
    await page.goto("about:blank");
    const execution = executionId();
    await park(id, delivery(id, { executionId: execution, nodeId: "draw", target: "all-viewers" }));
    expect((await pending(id)).body.parked).toBe(1);

    // coming back is enough: connecting is when a session asks what it missed
    await openGraph(page, id);
    await page.waitForTimeout(3000);
    expect((await stateOf(page)).drawn).toBe(1);
    expect((await pending(id)).body.parked).toBe(0);

    // A page load is a viewer.  Reloading is a new one, with a blank canvas,
    // so a hop that is still within its time is drawn again — and recorded as
    // a second viewer having drawn it, not as the same one drawing twice.
    await openGraph(page, id);                       // opening it again is a new viewer
    await page.waitForTimeout(3000);
    expect((await stateOf(page)).drawn).toBe(1);
    const record = await parkedRecord(id, execution, "draw-1");
    expect(record.runs).toHaveLength(2);

    // this viewer, asking again, is offered nothing
    expect(await resume(page, id)).toBe(0);
    await page.waitForTimeout(1000);
    expect((await stateOf(page)).drawn).toBe(1);

    await context.close();
  });

  test("a hop nobody takes becomes an error naming the reason; one taken in time does not", async ({ browser }) => {
    const id = graphId();
    const context = await browser.newContext();
    await pointAtDevServer(context);
    const page = await context.newPage();

    await openGraph(page, id);
    await buildHybridGraph(page);

    const abandoned = executionId();
    const taken = executionId();
    // addressed to a session that is not here, so nobody in this browser runs it
    await park(id, delivery(id, { executionId: abandoned, nodeId: "charge", seq: 2, target: "initiator", initiator: "a-session-that-left" }), 2000);
    await park(id, delivery(id, { executionId: taken, nodeId: "draw", target: "all-viewers" }), 60000);

    await resume(page, id);
    await page.waitForTimeout(3000);
    expect((await stateOf(page)).drawn).toBe(1);

    await page.waitForTimeout(2500);                 // let the abandoned one run out of time
    const swept = await sweep();
    expect(swept.body.expired.map((e: any) => e.nodeId)).toEqual(["charge"]);

    const gone = await parkedRecord(id, abandoned, "charge-2");
    expect(gone.state).toBe("expired");
    expect(gone.observationsKey).toContain("no-browser");

    const kept = await parkedRecord(id, taken, "draw-1");
    expect(kept.state).toBe("claimed");

    await context.close();
  });
});
