import type {Graph, Node} from "@plastic-io/plastic-io";
export default {
    removeInput(e: {
        nodeId: string,
        name: string,
    }) {
        const node = this.graphSnapshot.nodes.find((v: any) => v.id === e.nodeId);
        if (!node) {
            return this.this.orchestratorStore.raiseError(new Error("Cannot find node to update."));
        }
        const prop = node.properties.inputs.find((o: {name: string}) => o.name === e.name);
        node.properties.inputs.splice(node.properties.inputs.indexOf(prop), 1);
        // remove any connectors that refrenced this input
        this.graphSnapshot.nodes.forEach((v: any) => {
            v.edges.forEach((edge: {field: string, connectors: any[]}) => {
                const rmConnectors = edge.connectors.filter((connector) => {
                    return connector.nodeId === e.nodeId && connector.field === e.name;
                });
                if (rmConnectors.length > 0) {
                    rmConnectors.forEach((c: any) => {
                        edge.connectors.splice(edge.connectors.indexOf(c), 1);
                    });
                }
            });
        });
        this.updateGraphFromSnapshot("Remove Input");
    },
    removeOutput(e: {
        nodeId: string,
        name: string,
    }) {
        const node = this.graphSnapshot.nodes.find((v: any) => v.id === e.nodeId);
        if (!node) {
            return this.orchestratorStore.raiseError(new Error("Cannot find node to update."));
        }
        const prop = node.properties.outputs.find((o: {name: string}) => o.name === e.name);
        const edge = node.edges.find((o: {field: string}) => o.field === e.name);
        node.edges.splice(node.edges.indexOf(edge), 1);
        node.properties.outputs.splice(node.properties.outputs.indexOf(prop), 1);
        this.updateGraphFromSnapshot("Remove Output");
    },
    addInput(e: {
        nodeId: string,
        name: string,
        type: string,
        external: boolean,
        visible: boolean,
    }) {
        const node = this.graphSnapshot.nodes.find((v: any) => v.id === e.nodeId);
        if (!node) {
            return this.orchestratorStore.raiseError(new Error("Cannot find node to update."));
        }
        node.properties.inputs.push({
            name: e.name,
            type: e.type || "Object",
            external: e.external === undefined ? false : e.external,
            visible: e.visible === undefined ? true : e.visible,
        });
        this.updateGraphFromSnapshot("Add Input");
    },
    addOutput(e: {
        nodeId: string,
        name: string,
        type: string,
        external: boolean,
        visible: boolean,
    }) {
        const node = this.graphSnapshot.nodes.find((v: any) => v.id === e.nodeId);
        if (!node) {
            return this.orchestratorStore.raiseError(new Error("Cannot find node to update."));
        }
        node.properties.outputs.push({
            name: e.name,
            type: e.type || "Object",
            external: e.external === undefined ? false : e.external,
            visible: e.visible === undefined ? true : e.visible,
        });
        node.edges.push({
            field: e.name,
            connectors: [],
        });
        this.updateGraphFromSnapshot("Add Output");
    },
    deleteConnector(e: {id: string}) {
        this.graphSnapshot.nodes.forEach((v:  any) => {
            v.edges.forEach((edge: {connectors: any[]}) => {
                edge.connectors.forEach((connector: {id: string}, index) => {
                    if (e.id === connector.id) {
                        edge.connectors.splice(index, 1);
                    }
                });
            });
        });
        this.updateGraphFromSnapshot("Delete Connector");
    },
    selectConnector(e: {id: string}) {
        if (this.keys.event && (this.keys.event.shiftKey || this.keys.event.ctrlKey || this.keys.event.metaKey)) {
            if (this.selectedConnectors.map((c: {id: string}) => c.id).indexOf(e.id) === -1) {
                this.selectedConnectors.push(e);
            }
            return;
        }
        this.selectedConnectors = [e];
    },

    changeConnectorOrder(e: {nodeId: string, connectorId: string, direction: string}) {
        this.graphSnapshot.nodes.forEach((v:  any) => {
            v.edges.forEach((edge: {connectors: any[]}) => {
                edge.connectors.forEach((connector: {id: string}, index) => {
                    if (e.connectorId === connector.id && v.id === e.nodeId) {
                        edge.connectors.splice(index, 1);
                        edge.connectors.splice(index + (e.direction === "down" ? 1 : -1), 0, connector);
                    }
                });
            });
        });
        this.updateGraphFromSnapshot("Reorder Connectors");
    },
    changeInputOrder(e: {
        nodeId: string,
        name: string,
        direction: string,
    }) {
        const node = this.graphSnapshot.nodes.find((v: any) => v.id === e.nodeId);
        if (!node) {
            return this.orchestratorStore.raiseError(new Error("Cannot find node to update."));
        }
        const prop = node.properties.inputs.find((o: {name: string}) => o.name === e.name);
        if (!prop) {
            return this.orchestratorStore.raiseError(new Error("Cannot find a property to update."));
        }
        const propIndex = node.properties.inputs.indexOf(prop);
        node.properties.inputs.splice(propIndex, 1);
        node.properties.inputs.splice(propIndex + (e.direction === "down" ? 1 : -1), 0, prop);
        this.updateGraphFromSnapshot("Change Input Order");
    },
    changeOutputOrder(e: {
        nodeId: string,
        name: string,
        direction: string,
    }) {
        const node = this.graphSnapshot.nodes.find((v: any) => v.id === e.nodeId);
        if (!node) {
            return this.orchestratorStore.raiseError(new Error("Cannot find node to update."));
        }
        const prop = node.properties.outputs.find((o: {name: string}) => o.name === e.name);
        if (!prop) {
            return this.orchestratorStore.raiseError(new Error("Cannot find a property to update."));
        }
        const propIndex = node.properties.outputs.indexOf(prop);
        const edge = node.edges.find((o: {field: string}) => o.field === e.name);
        const edgeIndex = node.edges.indexOf(edge);
        node.properties.outputs.splice(propIndex, 1);
        node.properties.outputs.splice(propIndex + (e.direction === "down" ? 1 : -1), 0, prop);
        node.edges.splice(edgeIndex, 1);
        node.edges.splice(edgeIndex + (e.direction === "down" ? 1 : -1), 0, edge);
        this.updateGraphFromSnapshot("Change Output Order");
    },
} as ThisType<any>;
