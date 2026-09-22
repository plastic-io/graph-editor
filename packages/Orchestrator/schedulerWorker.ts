import Scheduler from "@plastic-io/plastic-io";
import {createDeepProxy, type Path} from "./proxy";
import {toJSON} from 'flatted';
import {BrowserExecutions} from "./browserExecutions";
import {ObservationRecorder} from "../GraphCrdt/observe";

/**
 * What a browser execution may spend before the scheduler stops it (plan
 * §4.6.6, PB-064).  The wall clock is generous because a graph may legitimately
 * wait on a user, while the hop and depth ceilings are what actually stop a
 * runaway loop from locking the worker.
 */
const DEFAULT_BUDGET = {wallMs: 120000, hops: 100000, fanOut: 10000, depth: 512, graceMs: 250};
const messenger = (source: any) => {
  return (event: any) => {
    postMessage({
      source,
      event: toJSON(event),
    });
  }
};
let scheduler: Scheduler;
let executions: BrowserExecutions | null = null;
/** The identity and revision the editor gave at init; a graph change keeps them. */
let session: any = {};
/** Answers to deliveries this worker asked the main thread to carry. */
const pendingDeliveries = new Map<number, (answer: any) => void>();
let deliveryRequestId = 0;
/** Linked graphs this worker has asked the main thread to find. */
const pendingLoads = new Map<number, (answer: any) => void>();
let loadRequestId = 0;
/** How long a linked graph may take to arrive before the link is unresolved. */
const LOAD_TIMEOUT_MS = 10000;
/**
 * A graph a node links to, found at the moment it is reached.
 *
 * The graph this worker is running answers for itself — that is a graph that
 * contains itself, and the document is already here.  Anything else is a
 * component published somewhere, which only the main thread can fetch (it has
 * the providers, the token and the server's address), so the worker asks and
 * waits.  Answering every request with the running graph, as this did, meant a
 * node linking an imported component silently ran the *host* graph instead.
 */
const loader = async (e: any): Promise<any> => {
  const url = String((e && e.url) || "");
  const here = scheduler && scheduler.graph ? scheduler.graph : null;
  if (here && (url.indexOf("/" + here.id + ".") !== -1 || url.indexOf("/" + here.url + ".") !== -1)) {
    return e.setValue(here);
  }
  const id = (loadRequestId += 1);
  const answer = await new Promise<any>((resolve) => {
    pendingLoads.set(id, resolve);
    postMessage({ source: 'load-request', event: toJSON({ id, url }) });
    setTimeout(() => {
      if (pendingLoads.delete(id)) {
        resolve(null);
      }
    }, LOAD_TIMEOUT_MS);
  });
  if (answer) {
    e.setValue(answer);
  }
};

const sendUpdateToMain = (path: Path, value: any): void => {
  postMessage({
    source: 'state-update',
    event: toJSON({ path, value }),
  });
};

const workerObj: { [key: string]: any } = {foo: 'bar'};

const workerObjProxy = createDeepProxy(workerObj, [], sendUpdateToMain);

let obj: any = workerObj;

const logger = {
  info(){},
  log(){},
  warn(){},
  error(){},
  debug(){},
};
const rpc = {
  init(e: any) {
    session = {owner: e.owner || session.owner, revisionId: e.revisionId || session.revisionId, budget: e.budget || session.budget, defaultCapture: e.defaultCapture || session.defaultCapture};
    e.owner = session.owner;
    e.revisionId = session.revisionId;
    e.budget = session.budget;
    e.defaultCapture = session.defaultCapture;

    const nodes = {} as any;
    e.graph.nodes.forEach((node: any) => {
      nodes[node.id] = nodes[node.id] || {};
      node.properties.inputs.forEach((input: any) => {
        nodes[node.id][input.name] = nodes[node.id][input.name] || undefined;
      });
    });
    workerObjProxy.nodes = nodes;

    // Observations and the capability host (plan §4.5.2/§4.5.3): one recorder
    // per execution, and the only route node code has to the outside world.
    executions = new BrowserExecutions({
      graphId: e.graph.id,
      revisionId: e.revisionId || "live",
      owner: e.owner || {sub: "anonymous", kind: "human", tenant: "none"},
      defaultCapture: e.defaultCapture,
      onFinished: (report: any) => {
        postMessage({
          source: 'execution-finished',
          event: toJSON(report),
        });
      },
    });
    executions.setGraph(e.graph);
    executions.update({
      // A node placed on the server is run there, through the main thread's
      // connection, and its output values come back to be routed here.
      deliverToServer: (delivery: any) => new Promise((resolve) => {
        deliveryRequestId += 1;
        const id = deliveryRequestId;
        pendingDeliveries.set(id, resolve);
        postMessage({source: 'delivery-request', event: toJSON({id, delivery})});
      }),
    });
    const budget = {...DEFAULT_BUDGET, ...(e.budget || {}), ...((e.graph.properties && e.graph.properties.budget) || {})};

    scheduler = new Scheduler(e.graph, e, workerObjProxy, logger, {
      budget,
      host: (info: any) => executions!.host(info),
      executeNode: ({nodeInterface, execution, runInProcess}: any) => {
        return executions!.runsHere(nodeInterface.node)
          ? runInProcess()
          : executions!.handOff(nodeInterface, execution);
      },
      contractMode: (e.graph.properties && e.graph.properties.contractMode === "reject") ? "reject" : "warn",
      /**
       * How deep a graph that contains itself may go before the scheduler
       * calls it a runaway (plastic-io 2.3).  When it stops is the graph's
       * business; this is the ceiling for one that does not.
       */
      linkedGraphDepth: (e.graph.properties && e.graph.properties.linkedGraphDepth) || 24,
    } as any);
    ObservationRecorder.EVENTS.forEach((name: string) => {
      scheduler.addEventListener(name, (event: any) => {
        if (executions) {
          executions.route(name, event);
        }
      });
    });
    scheduler.addEventListener("load", loader);
    scheduler.addEventListener("beginconnector", messenger('beginconnector'));
    scheduler.addEventListener("endconnector", messenger('endconnector'));
    scheduler.addEventListener("set", messenger('set'));
    scheduler.addEventListener("afterSet", messenger('afterSet'));
    scheduler.addEventListener("error", messenger('error'));
    scheduler.addEventListener("warning", messenger('warning'));
    scheduler.addEventListener("begin", messenger('begin'));
    scheduler.addEventListener("end", messenger('end'));
    // 2.1 events: custom observations from host.emit, and cancellations
    scheduler.addEventListener("observation", messenger('observation'));
    scheduler.addEventListener("cancel", messenger('cancel'));
  },
  /** Stop every open execution (scheduler 2.1); older schedulers have nothing to stop. */
  cancel(reason: string) {
    if (scheduler && typeof (scheduler as any).cancelAll === 'function') {
      return (scheduler as any).cancelAll(reason || 'cancelled');
    }
  },
} as any;
const panic = () => {
  const panic = () => {
    scheduler.removeEventListener("beginedge", panic);
    throw new Error('PANIC!');
  };
  scheduler.addEventListener("beginedge", panic);
  return;
}
onmessage = function(e: any) {
  if (e.data.method === 'panic') {
    return panic();
  }
  if (e.data.method === 'init') {
    return rpc.init.apply(null, e.data.args);
  }
  if (e.data.method === 'cancel') {
    return rpc.cancel.apply(null, e.data.args);
  }
  if (e.data.method === 'load-response') {
    const { id, graph } = e.data.args[0] || {};
    const resolve = pendingLoads.get(id);
    if (resolve) {
      pendingLoads.delete(id);
      resolve(graph || null);
    }
    return;
  }
  if (e.data.method === 'delivery-response') {
    const {id, answer} = e.data.args[0] || {};
    const resolve = pendingDeliveries.get(id);
    if (resolve) {
      pendingDeliveries.delete(id);
      resolve(answer);
    }
    return;
  }
  if (e.data.method === 'deliver') {
    // A node of this graph is placed here and an execution elsewhere reached
    // it (plan §4.8.2).  The same delivery may arrive twice after a reconnect,
    // so each one runs at most once.
    const delivery = e.data.args[0] || {};
    if (!scheduler || !executions || executions.seen(delivery)) {
      return;
    }
    const node = (scheduler.graph.nodes || []).find((n: any) => n.id === delivery.nodeId);
    if (!node) {
      return;
    }
    const handle = (scheduler as any).invoke(node.url, delivery.value, delivery.field, undefined, {
      executionId: delivery.executionId,
      revisionId: delivery.revisionId,
    });
    handle.done.catch(() => undefined);
    return;
  }
  if (e.data.method === 'invoke') {
    // An execution the editor started: it carries its own id so the editor can
    // follow it, and the observations name the revision they ran.
    const {url, value, field, currentNode, executionId, revisionId} = e.data.args[0] || {};
    const handle = (scheduler as any).invoke(url, value, field, currentNode, {executionId, revisionId});
    handle.done.catch(() => undefined);
    return;
  }
  if (e.data.method === 'change') {
    // The old scheduler's executions are cancelled cooperatively (2.1); the
    // panic listener stays as the stop for schedulers without cancelAll.
    rpc.cancel('graph changed');
    panic();
    rpc.init({graph: e.data.args[0]});
    return;
  }
  if (typeof (scheduler as any)[e.data.method] === 'function') {
    (scheduler as any)[e.data.method].apply(scheduler, e.data.args);
    return;
  }

  const { path, value } = e.data;

  for (let i = 0; i < path.length - 1; i++) {
    obj = obj[path[i]];
  }

  obj[path[path.length - 1]] = value;

}
