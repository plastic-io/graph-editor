/**
 * Browser executions (plan §4.5.2 PB-052, §4.5.3 PB-053).
 *
 * The editor keeps one scheduler for the open graph, and several executions
 * can be in flight at once (a template's impulse while a timer node is still
 * routing).  This module gives each execution its own observation recorder,
 * routes every scheduler event to the right one, and builds the `host` binding
 * that node code uses to reach the outside world.
 *
 * Leaf imports only: pulling the shared package's entry point here would drag
 * the whole CRDT surface into the worker bundle.
 */
import { ObservationRecorder, type Observation, type ExecutionRecord } from "../GraphCrdt/observe";
import { buildHostMembers } from "../GraphCrdt/host";
import { effectiveCapabilities } from "../GraphCrdt/capabilities";

export interface BrowserExecutionOptions {
  graphId: string;
  revisionId: string;
  owner: { sub: string; kind: string; tenant: string };
  /** Capabilities the signed-in principal holds; null when unrestricted (the owner). */
  principalCapabilities?: any[] | null;
  /** Manifest capabilities of a pinned component, when the editor knows them. */
  manifestCapabilities?: (node: any) => any[] | null;
  defaultCapture?: "none" | "meta" | "full";
  maxObservations?: number;
  /** Called once an execution ends, with everything it produced. */
  onFinished: (report: { record: ExecutionRecord; observations: Observation[] }) => void;
}

interface Tracked {
  recorder: ObservationRecorder;
  startedAt: number;
  url: string;
  field?: string;
}

export class BrowserExecutions {
  private tracked = new Map<string, Tracked>();
  private graph: any = null;
  private options: BrowserExecutionOptions;

  constructor(options: BrowserExecutionOptions) {
    this.options = options;
  }

  /** The graph the ports come from; call again whenever the worker reloads it. */
  setGraph(graph: any) {
    this.graph = graph;
  }

  update(options: Partial<BrowserExecutionOptions>) {
    this.options = { ...this.options, ...options };
  }

  private start(executionId: string, url: string, field?: string): Tracked {
    const recorder = new ObservationRecorder({
      graphId: this.options.graphId,
      revisionId: this.options.revisionId,
      executionId,
      owner: this.options.owner,
      domain: "browser",
      defaultCapture: this.options.defaultCapture,
      maxObservations: this.options.maxObservations,
    });
    if (this.graph) {
      recorder.learn(this.graph);
    }
    const tracked = { recorder, startedAt: Date.now(), url, field };
    this.tracked.set(executionId, tracked);
    return tracked;
  }

  /** Every scheduler event passes through here on its way to a recorder. */
  route(name: string, e: any) {
    const executionId = e && e.executionId;
    if (!executionId) {
      return;                                    // an event from a scheduler older than 2.1
    }
    let tracked = this.tracked.get(executionId);
    if (!tracked) {
      if (name !== "begin") {
        return;                                  // an execution that began before this manager existed
      }
      tracked = this.start(executionId, e.url, e.field);
    }
    tracked.recorder.handle(name, e);
    if (name === "end") {
      this.finish(executionId, e);
    }
  }

  private finish(executionId: string, e: any) {
    const tracked = this.tracked.get(executionId);
    if (!tracked) {
      return;
    }
    this.tracked.delete(executionId);
    const summary = tracked.recorder.summary();
    const record: ExecutionRecord = {
      executionId,
      graphId: this.options.graphId,
      revisionId: this.options.revisionId,
      owner: this.options.owner,
      domain: "browser",
      entry: { nodeUrl: tracked.url, field: tracked.field },
      startedAt: new Date(tracked.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      state: e && e.state ? String(e.state) : "completed",
      reason: e && e.reason ? String(e.reason) : undefined,
      duration: e && typeof e.duration === "number" ? e.duration : Date.now() - tracked.startedAt,
      hops: e && typeof e.hops === "number" ? e.hops : 0,
      errors: e && typeof e.errors === "number" ? e.errors : 0,
      observations: { count: summary.count, key: ObservationRecorder.keyFor(this.options.graphId, executionId, tracked.startedAt), sampled: summary.sampled, capped: summary.capped },
      effects: summary.effects,
      correlationId: executionId,
    };
    this.options.onFinished({ record, observations: tracked.recorder.buffer.slice() });
  }

  /**
   * The `host` binding for one node invocation.  Effects the browser cannot
   * carry (a secret, the shared key-value store) still run their capability
   * check and then say so, which is the answer a node needs: move me to the
   * server.
   */
  host({ execution, nodeInterface }: any): Record<string, any> {
    const executionId = execution && execution.executionId;
    const tracked = executionId ? this.tracked.get(executionId) : undefined;
    const recorder = tracked ? tracked.recorder : this.start(executionId || "unknown", (execution && execution.url) || "unknown").recorder;
    const node = nodeInterface && nodeInterface.node;
    return buildHostMembers({
      graphId: this.options.graphId,
      node,
      spanId: nodeInterface && nodeInterface.spanId,
      signal: execution && execution.token ? execution.token.signal : undefined,
      effective: effectiveCapabilities(
        node,
        this.options.manifestCapabilities ? this.options.manifestCapabilities(node) : null,
        this.options.principalCapabilities === undefined ? null : this.options.principalCapabilities,
      ),
      recorder,
      principal: this.options.owner,
    }, {
      fetchImpl: typeof fetch === "function" ? fetch.bind(globalThis) : undefined,
      domain: "browser",
    });
  }

  /** Executions still open, for the watchdog. */
  get open(): string[] {
    return [...this.tracked.keys()];
  }
}
