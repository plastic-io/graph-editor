import Scheduler from "@plastic-io/plastic-io";
import {createDeepProxy, type Path} from "./proxy";
import {toJSON} from 'flatted';
const messenger = (source: any) => {
  return (event: any) => {
    postMessage({
      source,
      event: toJSON(event),
    });
  }
};
let scheduler: Scheduler;
const loader = async (e: any): Promise<any> => {
  return e.setValue(scheduler.graph);
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

    const nodes = {} as any;
    e.graph.nodes.forEach((node: any) => {
      nodes[node.id] = nodes[node.id] || {};
      node.properties.inputs.forEach((input: any) => {
        nodes[node.id][input.name] = nodes[node.id][input.name] || undefined;
      });
    });
    workerObjProxy.nodes = nodes;

    scheduler = new Scheduler(e.graph, e, workerObjProxy, logger);
    scheduler.addEventListener("load", loader);
    scheduler.addEventListener("beginconnector", messenger('beginconnector'));
    scheduler.addEventListener("endconnector", messenger('endconnector'));
    scheduler.addEventListener("set", messenger('set'));
    scheduler.addEventListener("afterSet", messenger('afterSet'));
    scheduler.addEventListener("error", messenger('error'));
    scheduler.addEventListener("warning", messenger('warning'));
    scheduler.addEventListener("begin", messenger('begin'));
    scheduler.addEventListener("end", messenger('end'));
  }
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
  if (e.data.method === 'change') {
    // HACK: probably needs some sort of GC here
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
