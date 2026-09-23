import { describe, it, expect } from "vitest";
import Panel from "../DeploymentStatus.vue";

/**
 * What this graph deploys (plan §4.9, PB-094).
 *
 * The panel's job is to say, in a line a person can read, what a template is
 * and what deploying it would do — including when the answer is "this
 * environment would refuse it" and when it is "this server cannot ask".  These
 * are the lines themselves, tested where they are written.
 */
const component: any = Panel;
const methods = component.methods;
const stack = (over: any = {}) => ({
  nodeId: "stack",
  name: "Uploads bucket",
  stack: { name: "pio-dev-uploads", account: "695527765921", region: "us-west-1", environment: "dev" },
  validation: { ok: true, problems: [], counts: { resources: 2, outputs: 0, parameters: 0 } },
  status: null,
  ...over,
});
/** the component's own methods, bound to just enough of an instance */
const on = (data: any = {}) => {
  const self: any = { stacks: [], canPlan: true, busy: false, planning: "", message: "", ...data };
  Object.keys(methods).forEach((key) => { self[key] = methods[key].bind(self); });
  return self;
};

class FakeProvider {
  listed: string[] = [];
  planned: string[] = [];
  answer: any = { stacks: [stack()], canPlan: true };
  failWith: Error | null = null;
  async listStacks(graphId: string) {
    this.listed.push(graphId);
    if (this.failWith) { throw this.failWith; }
    return this.answer;
  }
  async planStack(graphId: string, nodeId: string) {
    this.planned.push(nodeId);
    if (this.failWith) { throw this.failWith; }
    return { status: { state: "planned", plan: { changes: [], destructive: false } } };
  }
}
const withProvider = (provider: any, data: any = {}) => {
  const self = on(data);
  self.provider = () => provider;
  self.graphId = () => "g1";
  return self;
};

describe("the lines a person reads", () => {
  it("says where the stack is, how big it is, and what is known of it", () => {
    const self = on();
    expect(self.subtitleFor(stack())).toBe("pio-dev-uploads · us-west-1 · dev — 2 resources — never planned");
    expect(self.stateOf(stack())).toBe("never planned");
    expect(self.iconFor(stack())).toBe("mdi-cloud-question-outline");
  });

  it("a template this environment would refuse says so before anything is asked of AWS", () => {
    const refused = stack({ validation: { ok: false, counts: { resources: 1 }, problems: [{ code: "RESOURCE_TYPE_NOT_ALLOWED", message: "AWS::EC2::NatGateway is not one of the resource types this environment deploys", resource: "Gateway" }] } });
    const self = on();
    expect(self.stateOf(refused)).toBe("this environment would refuse this template");
    expect(self.colorFor(refused)).toBe("error");
    expect(self.problemsOf(refused)[0].resource).toBe("Gateway");
  });

  it("a plan that adds things reads differently from one that takes something away", () => {
    const self = on();
    expect(self.changeLine({ changes: [{ action: "Add" }, { action: "Add" }, { action: "Modify" }], destructive: false })).toBe("2 added, 1 changed");
    expect(self.changeLine({ changes: [{ action: "Remove" }], destructive: true })).toBe("1 removed — this takes something away");
    expect(self.changeLine({ changes: [], destructive: false })).toBe("nothing would change: the stack already matches");

    const destructive = stack({ status: { state: "planned", plan: { changes: [{ action: "Remove" }], destructive: true } } });
    expect(self.iconFor(destructive)).toBe("mdi-alert-outline");
    expect(self.colorFor(destructive)).toBe("warning");
    const clean = stack({ status: { state: "planned", plan: { changes: [{ action: "Add" }], destructive: false } } });
    expect(self.colorFor(clean)).toBe("success");
  });

  it("a failure shows its reason, and a refusal shows its problems instead", () => {
    const self = on();
    const failed = stack({ status: { state: "failed", reason: "this instance holds no CloudFormation authority" } });
    expect(self.reasonOf(failed)).toMatch(/no CloudFormation authority/);
    expect(self.colorFor(failed)).toBe("error");
    const bothKinds = stack({
      validation: { ok: false, counts: { resources: 1 }, problems: [{ code: "CUSTOM_RESOURCE", message: "a custom resource runs code of its own" }] },
      status: { state: "failed", reason: "this desired state is not one this environment allows", problems: [{ code: "CUSTOM_RESOURCE", message: "…" }] },
    });
    // the template's own problems are the ones worth reading first
    expect(self.problemsOf(bothKinds)[0].message).toMatch(/runs code of its own/);
    expect(self.reasonOf(bothKinds)).toBe("");
  });

  it("the badge says the worst thing there is to say", () => {
    const badge = component.computed.badgeColor;
    expect(badge.call({ stacks: [stack()], problemsOf: methods.problemsOf, reasonOf: methods.reasonOf, planOf: methods.planOf })).toBe("info");
    expect(badge.call({ stacks: [stack({ status: { state: "planned", plan: { changes: [{ action: "Remove" }], destructive: true } } })], problemsOf: methods.problemsOf, reasonOf: methods.reasonOf, planOf: methods.planOf })).toBe("warning");
    expect(badge.call({ stacks: [stack({ validation: { ok: false, problems: [{ code: "MACRO", message: "…" }], counts: { resources: 1 } } })], problemsOf: methods.problemsOf, reasonOf: methods.reasonOf, planOf: methods.planOf })).toBe("error");
  });
});

describe("what it asks the server", () => {
  it("lists the stacks and remembers whether this server can plan at all", async () => {
    const provider = new FakeProvider();
    provider.answer = { stacks: [stack()], canPlan: false };
    const self = withProvider(provider);
    await self.refresh();
    expect(provider.listed).toEqual(["g1"]);
    expect(self.stacks).toHaveLength(1);
    expect(self.canPlan).toBe(false);
    expect(self.busy).toBe(false);
  });

  it("asking what a change would do goes through the same route an agent uses, and refreshes after", async () => {
    const provider = new FakeProvider();
    const self = withProvider(provider);
    await self.plan(stack());
    expect(provider.planned).toEqual(["stack"]);
    expect(provider.listed).toEqual(["g1"]);   // the answer is re-read rather than assumed
    expect(self.planning).toBe("");
  });

  it("a refusal is an answer, and lands where a person will see it", async () => {
    const provider = new FakeProvider();
    provider.failWith = Object.assign(new Error("this graph carries infrastructure this environment does not allow"), { code: "IAC_REFUSED" });
    const self = withProvider(provider);
    await self.plan(stack());
    expect(self.message).toMatch(/does not allow/);
    expect(self.planning).toBe("");
  });

  it("a server with no such route is not an error on the screen", async () => {
    const self = withProvider({});
    await self.refresh();
    expect(self.message).toBe("");
    expect(self.stacks).toEqual([]);
  });
});
