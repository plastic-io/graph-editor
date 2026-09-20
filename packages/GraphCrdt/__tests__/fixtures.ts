/** Realistic graph fixtures shaped exactly like the editor's own output. */

let seq = 0;
export function testId(prefix = "id"): string {
  seq += 1;
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

export function makeConnector(over: Record<string, any> = {}) {
  return {
    id: testId("con"),
    nodeId: "node-a",
    field: "input",
    graphId: "graph-1",
    version: 1,
    ...over,
  };
}

export function makeNode(over: Record<string, any> = {}) {
  const id = over.id || testId("node");
  return {
    id,
    edges: [
      {
        field: "output",
        connectors: [],
      },
    ],
    version: 1,
    graphId: "graph-1",
    artifact: null,
    url: `url-${id}`,
    data: null,
    properties: {
      inputs: [{ name: "input", type: "Object", external: false, visible: true }],
      outputs: [{ name: "output", type: "Object", external: false, visible: true }],
      groups: [],
      name: `Node ${id}`,
      description: "",
      createdOn: 1700000000000,
      lastUpdate: 1700000000000,
      tags: [],
      icon: "mdi-node-rectangle",
      positionAbsolute: false,
      appearsInPresentation: false,
      appearsInExport: false,
      x: 10,
      y: 20,
      z: 0,
      presentation: { x: 10, y: 20, z: 0, order: 0 },
    },
    template: {
      set: "edges.output = value;",
      vue: "<template><div>hello</div></template>",
    },
    ...over,
  };
}

export function makeGraph(over: Record<string, any> = {}) {
  const a = makeNode({ id: "node-a", properties: { ...makeNode({ id: "node-a" }).properties, createdOn: 1 } });
  const b = makeNode({ id: "node-b", properties: { ...makeNode({ id: "node-b" }).properties, createdOn: 2 } });
  a.edges[0].connectors.push(
    makeConnector({ id: "con-1", nodeId: "node-b", field: "input" }) as any,
  );
  return {
    id: "graph-1",
    version: 3,
    url: "MyGraph",
    nodes: [a, b],
    properties: {
      name: "My Graph",
      description: "a test graph",
      exportable: false,
      icon: "mdi-graph",
      createdBy: "tester",
      createdOn: 1700000000000,
      lastUpdate: 1700000000000,
      height: 150,
      width: 300,
      timeout: 30000,
      logLevel: 2,
      template: "<template><div>graph</div></template>",
    },
    ...over,
  };
}

/** Deep clone that keeps the fixtures independent between assertions. */
export function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
