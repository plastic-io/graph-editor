const shiftKeyCode = 16;
const metaKeyCode = 91;
const ctrlKeyCode = 17;
const spaceKeyCode = 32;
import type {Node} from "@plastic-io/plastic-io";
import type {Store} from 'pinia';
import {linkInnerNodeEdges} from "@plastic-io/plastic-io";
import {newId} from "@plastic-io/graph-editor-vue3-utils";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";

import {useStore as useInputStore} from "./store";
// import {applyGraphChanges, newId, updateBoundingRect, remapNodes} from "./mutations"; // eslint-disable-line
export default class MouseAction {
    inputStore: any
    orchestratorStore: any
    graphStore: any
    preferencesStore: any
  constructor() {
      this.inputStore = useInputStore();
      this.graphStore = useGraphStore();
      this.orchestratorStore = useOrchestratorStore();
      this.preferencesStore = usePreferencesStore();
  }
  remapNodes(arr: any) {
    return this.graphStore.graph.nodes.filter((v: any) => {
      return arr.find((vi: any) => v.id === vi.id);
    });
  }
  applyGraphChanges(description: string) {
    this.graphStore.updateGraphFromSnapshot(description);
  }
  mouse(mouse: any) {
    if (this.orchestratorStore.inRewindMode) {
        console.warn("No mouse based mutations during rewind mode");
        return;
    }
    const locked = this.orchestratorStore.presentation || this.orchestratorStore.locked;
    const ctrl = mouse.event.ctrlKey || mouse.event.metaKey;
    const shift = mouse.event.shiftKey;
    const gridSize = this.preferencesStore.preferences.snapToGrid && !shift ? this.preferencesStore.preferences.gridSize : 1;
    const addKey = shift || ctrl;
    const pastDeadZone = this.graphStore.translating.mouse ? (Math.abs(mouse.x - this.graphStore.translating.mouse.x) > 2
        || Math.abs(mouse.y - this.graphStore.translating.mouse.y) > 2) : false;
    // TODO: This whole grouping thing seems suspect.
    // Might need to reimagine how it works.  Moving on.
    const expandGroupNodeArray = (arr: any[]) => {
        let addCount = 0;
        // gather items in related groups
        const groupIds: string[] = [];
        // HACK: sometimes this array is populated with an empty member, not sure why, needs a fix
        arr.filter(v => !!v).forEach((v: Node) => {
            groupIds.push(...v.properties.groups);
        });
        this.graphStore.graph.nodes.forEach((v: Node) => {
            if (v.properties.groups.find((value: string) => groupIds.includes(value)) && arr.indexOf(v) === -1) {
                addCount += 1;
                arr.push(v);
            }
        });
        if (addCount > 0) {
            expandGroupNodeArray(arr);
        }
    };
    const remapHovered = () => {
        return this.graphStore.graph.nodes.find((v: Node) => {
            return this.graphStore.hoveredNode.id === v.id;
        });
    }
    // check if the mouse is hovering over any connectors using LUTs generated by bezier.ts plugin
    let x = (mouse.x - this.graphStore.view.x) / this.graphStore.view.k;
    let y = (mouse.y - this.graphStore.view.y) / this.graphStore.view.k;
    // margin
    let m = 5;
    // map LUTs for collions
    const luts = Object.keys(this.graphStore.luts).map((connectorId: string) => {
        return {
            output: this.graphStore.luts[connectorId].output,
            input: this.graphStore.luts[connectorId].input,
            node: this.graphStore.luts[connectorId].node,
            connector: this.graphStore.luts[connectorId].connector,
            table: this.graphStore.luts[connectorId].lut,
        };
    });
    // adding a connector
    if (this.graphStore.hoveredPort && !this.inputStore.mouse.lmb && mouse.lmb && !this.graphStore.movingConnector && !locked) {
        this.graphStore.ltrPct = this.graphStore.hoveredPort.type === "output" ? 0 : 1;
        this.graphStore.addingConnector = this.graphStore.hoveredPort;
        this.graphStore.addingConnector.connector = {
            id: newId(),
            nodeId: null,
            field: null,
            graphId: null,
            version: null,
        };
    }
    // moving a connector
    if (this.graphStore.hoveredConnector && !this.inputStore.mouse.lmb && mouse.lmb && !locked) {
        this.graphStore.movingConnector = this.graphStore.hoveredConnector;
    }
    // draw select box maybe
    if (this.graphStore.selectionRect.visible ||
        (      !this.graphStore.hoveredConnector
            && !this.graphStore.movingConnector
            && pastDeadZone
            && !this.graphStore.hoveredNode
            && !this.graphStore.hoveredPort
            && !this.graphStore.addingConnector
            && !this.inputStore.keys[spaceKeyCode]
            && this.graphStore.movingNodes.length === 0
        )) {
        if (mouse.lmb && this.graphStore.translating.mouse && !this.graphStore.translating.isMap) {
            this.graphStore.selectionRect.visible = true;
            let x = this.graphStore.translating.mouse.x - mouse.x;
            let y = this.graphStore.translating.mouse.y - mouse.y;
            this.graphStore.selectionRect.x =
                (Math.min(this.graphStore.translating.mouse.x, this.graphStore.translating.mouse.x - x) - this.graphStore.view.x) / this.graphStore.view.k;
            this.graphStore.selectionRect.y =
                (Math.min(this.graphStore.translating.mouse.y, this.graphStore.translating.mouse.y - y) - this.graphStore.view.y) / this.graphStore.view.k;
            this.graphStore.selectionRect.width = Math.abs(x) / this.graphStore.view.k;
            this.graphStore.selectionRect.height = Math.abs(y) / this.graphStore.view.k;
            this.graphStore.selectionRect.right = this.graphStore.selectionRect.x + this.graphStore.selectionRect.width;
            this.graphStore.selectionRect.bottom = this.graphStore.selectionRect.y + this.graphStore.selectionRect.height;
        } else if (this.graphStore.selectionRect.visible) {
            this.graphStore.selectionRect = {visible: false, x: 0, y: 0, height: 0, width: 0, right: 0, bottom: 0};
        }
    }
    // selection box is moving around, clear out the selection every move unless addkey is held
    if (this.graphStore.selectionRect.visible && !addKey && this.inputStore.mouse.lmb) {
        this.graphStore.selectedConnectors = [];
        this.graphStore.selectedNodes = [];
    }
    this.graphStore.connectorWarn = null;
    // check hits on the connector LUT to find connector selection and connection hovers
    this.graphStore.hoveredConnector = null;
    if (!this.graphStore.addingConnector) {
        for (let j = 0; j < luts.length; j += 1) {
            const t = luts[j].table;
            const connector = luts[j].connector;
            const node = luts[j].node;
            const input = luts[j].input;
            const output = luts[j].output;
            for (let i = 0; i < t.length; i += 1) {
                if ((t[i].x < x && t[i].x + m > x && t[i].y < y && t[i].y + m > y)
                    || (t[i].x >= this.graphStore.selectionRect.x && t[i].x <= this.graphStore.selectionRect.x + this.graphStore.selectionRect.width
                    && t[i].y >= this.graphStore.selectionRect.y && t[i].y <= this.graphStore.selectionRect.y + this.graphStore.selectionRect.height)) {
                    // left to right % of the hit
                    if (!this.graphStore.movingConnector && !this.graphStore.addingConnector) {
                        this.graphStore.ltrPct = i / t.length;
                    }
                    // check if this connector should be selected as well as hovered
                    if ((mouse.lmb && !this.inputStore.mouse.lmb) || this.graphStore.selectionRect.visible) {
                        // maybe remove the previous selection before adding this one
                        if (!(this.inputStore.keys[shiftKeyCode] || this.inputStore.keys[metaKeyCode] || this.inputStore.keys[ctrlKeyCode])
                            && !this.graphStore.selectionRect.visible) {
                            this.graphStore.selectedConnectors = [];
                        }
                        if (this.graphStore.selectedConnectors.indexOf(connector) === -1) {
                            this.graphStore.selectedConnectors.push(connector);
                        }
                    }
                    // don't hover other connectors while moving a connector
                    if (!this.graphStore.movingConnector && !this.graphStore.selectionRect.visible) {
                        this.graphStore.hoveredConnector = {node, connector, input, output};
                    }
                    break;
                }
            }
        }
    }
    // trying to move a connector to this port
    if (this.graphStore.hoveredPort && this.graphStore.movingConnector && !this.graphStore.addingConnector) {
        // if the user grabbed the left side of the connector, connect from right to left, else left to right (ltr).
        const ltr = this.graphStore.ltrPct > 0.5;
        const io =  ltr ? 'output' : 'input';
        const rio =  !ltr ? 'output' : 'input';
        // hovering over the right type of port input vs. output
        if (this.graphStore.hoveredPort.type === rio) {
            // edge is always defined on the output
            const node = this.graphStore.graphSnapshot.nodes.find((v: Node) => v.id === this.graphStore.movingConnector.output.node.id);
            const edge = node.edges.find((e: {field: string}) => e.field === this.graphStore.movingConnector.output.field.name);
            const connector = edge.connectors.find((e: {id: string}) => e.id === this.graphStore.movingConnector.connector.id);
            const typeA = this.graphStore.movingConnector[io].field.type;
            const typeB = this.graphStore.hoveredPort.field.type;
            const valid = typeA === typeB || (typeA === "Object" || typeB === "Object");
            const msg = "Cannot connect " + typeA + " to " + typeB;
            if (!valid) {
                this.graphStore.connectorWarn = msg;
            }
            if (!mouse.lmb && this.inputStore.mouse.lmb) {
                if (valid) {
                    if (ltr) {
                        // if changing the target of an output (ltr), just change the connector fields
                        connector.nodeId = this.graphStore.hoveredPort.node.id;
                        connector.field = this.graphStore.hoveredPort.field.name;
                    } else {
                        // if changing output to another output, delete this connector
                        const rmCon = edge.connectors.find((c: any) => {
                            return connector.field === c.field;
                        });
                        edge.connectors.splice(edge.connectors.indexOf(rmCon), 1);
                        // and add it to a new edge
                        connector.nodeId = this.graphStore.movingConnector.input.node.id;
                        connector.field = this.graphStore.movingConnector.input.field.name;
                        this.graphStore.hoveredPort.edge.connectors.push(connector);
                    }
                    this.applyGraphChanges("Move Connector");
                    this.graphStore.movingConnector = null;
                } else {
                    this.orchestratorStore.showError = true;
                    this.orchestratorStore.error = msg;
                }
            }
        }
    }
    // add a new connector to a port
    if (this.graphStore.hoveredPort && this.graphStore.addingConnector
            && this.graphStore.addingConnector.node.id !== this.graphStore.hoveredPort.node.id) {
        
        const node = this.graphStore.graphSnapshot.nodes.find((v: Node) => v.id === this.graphStore.addingConnector.node.id);
        const edge = node.edges.find((e: {field: string}) => e.field === this.graphStore.addingConnector.field.name);
        const connector = this.graphStore.addingConnector.connector;
        const typeA = this.graphStore.addingConnector.field.type;
        const typeB = this.graphStore.hoveredPort.field.type;
        const valid = typeA === typeB || (typeA === "Object" || typeB === "Object");
        const msg = "Cannot connect " + typeA + " to " + typeB;
        if (!valid) {
            this.graphStore.connectorWarn = msg;
        }
        if (!mouse.lmb && this.inputStore.mouse.lmb) {
            if (valid) {
                if (this.graphStore.hoveredPort.type === "input" && this.graphStore.addingConnector.type === 'output') {
                    connector.field = this.graphStore.hoveredPort.field.name;
                    connector.nodeId = this.graphStore.hoveredPort.node.id;
                    connector.graphId = this.graphStore.hoveredPort.node.graphId;
                    connector.version = this.graphStore.hoveredPort.node.version;
                    edge.connectors.push(connector);
                    if (node.linkedGraph) {
                        linkInnerNodeEdges(node, this.graphStore.scheduler.instance);
                    }
                } else if (this.graphStore.hoveredPort.type === "output" && this.graphStore.addingConnector.type === 'input') {
                    // add connector to the hovered port's node
                    const node = this.graphStore.graphSnapshot.nodes.find((v: Node) => v.id === this.graphStore.hoveredPort.node.id);
                    const edge = node.edges.find((e: {field: string}) => e.field === this.graphStore.hoveredPort.field.name);
                    connector.field = this.graphStore.addingConnector.field.name;
                    connector.nodeId = this.graphStore.addingConnector.node.id;
                    connector.graphId = this.graphStore.addingConnector.node.graphId;
                    connector.version = this.graphStore.addingConnector.node.version;
                    edge.connectors.push(connector);
                 }
                this.applyGraphChanges("Add Connector");
                this.graphStore.addingConnector = null;
            } else {
                this.orchestratorStore.showError = true;
                this.orchestratorStore.error = "Cannot connect " + typeA + " to " + typeB;
            }
        }
    }
    // drop moving nodes and connectors
    if (!mouse.lmb && this.inputStore.mouse.lmb &&
        (this.graphStore.movingNodes.length > 0
            || this.graphStore.movingConnector !== null
            || this.graphStore.addingConnector !== null
        )) {
        if (this.graphStore.movingNodes.length > 0) {
            this.graphStore.movingNodes = [];
            if (pastDeadZone) {
                this.applyGraphChanges("Move Nodes");
            }
        }
        if (this.graphStore.movingConnector && pastDeadZone) {
            // delete moving connector if it didn't find a home
            const edge = this.graphStore.movingConnector.output.node.edges.find((edge: any) => {
                return edge.field === this.graphStore.movingConnector.output.field.name;
            });
            const rmCon = edge.connectors.find((c: any) => {
                return c.field === this.graphStore.movingConnector.output.field.name;
            });
            edge.connectors.splice(edge.connectors.indexOf(rmCon), 1);
            this.graphStore.movingConnector = null;
        }
        if (this.graphStore.addingConnector) {
            this.graphStore.addingConnector = null;
        }
        this.graphStore.translating = {};
    }
    // mouse button was just released on nothing and no addKey was pressed
    if (!mouse.lmb && this.inputStore.mouse.lmb && !this.graphStore.hoveredNode
        && !pastDeadZone && !this.graphStore.hoveredConnector && !addKey) {
        this.graphStore.$patch({
            selectedConnectors: [],
            selectedNodes: [],
            primaryGroup: null,
            selectedNode: null,
        });
    }
    // start moving nodes
    if (!this.inputStore.mouse.lmb && mouse.lmb && this.graphStore.hoveredNode && this.graphStore.movingNodes.length === 0 && !locked) {
        const selected = this.remapNodes(this.graphStore.selectedNodes);
        if (selected.find((v: Node) => v.id === this.graphStore.hoveredNode.id)) {
            this.graphStore.movingNodes = [
                ...selected,
            ];
        } else {
            // node being moved is not part of the selection, so move it solo
            this.graphStore.movingNodes = [
                remapHovered(),
            ];
        }
        this.graphStore.groupNodes = [
            ...this.graphStore.movingNodes,
        ];
        expandGroupNodeArray(this.graphStore.movingNodes);
    } else {
        // add to node selection
        if (!mouse.lmb && this.inputStore.mouse.lmb && !pastDeadZone && this.graphStore.movingNodes.length === 0) {
            if (!addKey || !this.graphStore.hoveredNode) {
                this.graphStore.selectedNodes = [];
                this.graphStore.selectedGroups = [];
            }
            if (this.graphStore.hoveredNode) {
                const v = this.graphStore.graph.nodes.find((v: Node) => v.id === this.graphStore.hoveredNode.id);
                if (this.graphStore.selectedNodes.map((v: Node) => v.id).indexOf(v.id) === -1) {
                    this.graphStore.selectedNodes.push(v);
                }
                this.graphStore.selectedNode = v;
            }
            if (this.graphStore.selectedNodes.length > 0) {
                this.graphStore.groupNodes = [
                    ...this.graphStore.selectedNodes,
                ];
                expandGroupNodeArray(this.graphStore.selectedNodes);
            }
        }
    }
    // when selectionRect is visible, add overlapping nodes to selection
    if (this.graphStore.selectionRect.visible) {
        this.graphStore.graph.nodes.forEach((v: Node) => {
            const el = document.getElementById("node-" + v.id);
            if (!el) {
                return;
            }
            const elRect = el.getBoundingClientRect();
            const rect = {
                x: (elRect.x - this.graphStore.view.x) / this.graphStore.view.k,
                y: (elRect.y - this.graphStore.view.y) / this.graphStore.view.k,
                bottom: ((elRect.y - this.graphStore.view.y) / this.graphStore.view.k) + (elRect.height / this.graphStore.view.k),
                right: ((elRect.x - this.graphStore.view.x) / this.graphStore.view.k) + (elRect.width / this.graphStore.view.k),
            };
            const sel = this.graphStore.selectionRect;
            if (rect.x < sel.right
                && rect.right > sel.x
                && rect.y < sel.bottom
                && rect.bottom > sel.y) {
                if (this.graphStore.selectedNodes.map((v: Node) => v.id).indexOf(v.id) === -1) {
                    this.graphStore.selectedNodes.push(v);
                }
                this.graphStore.selectedNode = v;
            }
        });
        expandGroupNodeArray(this.graphStore.selectedNodes);
    }
    // expand selected groups to include related groups, then add them to the selection
    if (this.graphStore.groupNodes.length === 1) {
        expandGroupNodeArray(this.graphStore.groupNodes);
        this.graphStore.selectedGroups = this.graphStore.groupNodes;
        if (this.graphStore.groupNodes.length !== 1) {
            this.graphStore.primaryGroup = this.graphStore.groupNodes[0].properties.groups[0];
        }
    }
    // translate view
    if (((this.inputStore.keys[spaceKeyCode] || this.graphStore.translating.isMap) && mouse.lmb) || mouse.mmb) {
        mouse.event.preventDefault();
        const p = {
            x: this.graphStore.translating.view.x + (mouse.x - this.graphStore.translating.mouse.x),
            y: this.graphStore.translating.view.y + (mouse.y - this.graphStore.translating.mouse.y),
        };
        if (this.graphStore.translating.isMap) {
            p.x = this.graphStore.translating.view.x - ((mouse.x - this.graphStore.translating.mouse.x) * this.graphStore.mapScale * this.graphStore.view.k);
            p.y = this.graphStore.translating.view.y - ((mouse.y - this.graphStore.translating.mouse.y) * this.graphStore.mapScale * this.graphStore.view.k);
        }
        this.graphStore.view.x = p.x * 1;
        this.graphStore.view.y = p.y * 1;
    }
    // move nodes
    if (this.graphStore.movingNodes.length > 0 && !locked) {
        this.graphStore.movingNodes.forEach((movingNode: any) => {
            const node = this.graphStore.graphSnapshot.nodes.find((v: Node) => movingNode.id === v.id);
            const transNode = this.graphStore.translating.nodes.find((v: any) => movingNode.id === v.id);
            const x = transNode.properties.x + ((mouse.x - this.graphStore.translating.mouse.x) / this.graphStore.view.k);
            const y = transNode.properties.y + ((mouse.y - this.graphStore.translating.mouse.y) / this.graphStore.view.k);
            node.properties.x = Math.floor(x / gridSize) * gridSize;
            node.properties.y = Math.floor(y / gridSize) * gridSize;
        });
    }
    this.graphStore.updateBoundingRect();
    // set state last so we can check this.inputStore.mouse/mouse diff
    this.inputStore.$patch({mouse});
  }
}