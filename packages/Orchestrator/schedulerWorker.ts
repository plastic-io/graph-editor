import Scheduler from "@plastic-io/plastic-io";
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
  const artifactPrefix = "artifacts/";
  if ("setValue" in e) {
      const pathParts = e.url.split("/");
      const itemId = pathParts[2].split(".")[0];
      const itemVersion = pathParts[2].split(".")[1];
      const itemType = pathParts[1];
      if (itemType === "graph" && itemId === scheduler.graph.id) {
          return e.setValue(scheduler.graph);
      }
      const item = localStorage.getItem(artifactPrefix + itemId + "." + itemVersion);
      e.setValue(item);
  }
};
const logger = {
  info(){},
  log(){},
  warn(){},
  error(){},
  debug(){},
};
const store = {
  graph: null as any,
};
const rpc = {
  init(e: any) {
    store.graph = e.graph;
    scheduler = new Scheduler(store.graph, {}, {}, logger);
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
onmessage = function(e: any) {
  if (e.data.method === 'init') {
    return rpc.init.apply(null, e.data.args);
  }
  if (e.data.method === 'change') {
    store.graph = e.data.args[0];
    return;
  }
  (scheduler as any)[e.data.method].apply(scheduler, e.data.args);
}
