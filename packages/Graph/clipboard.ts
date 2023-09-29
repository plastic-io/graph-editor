import type {Graph, Node} from "@plastic-io/plastic-io";
import * as JSZip from "jszip";
import {newId} from "@plastic-io/graph-editor-vue3-utils";
export default {
    async unzip(file: any, fileName: string): Promise<any> {
        const zip = new (JSZip as any)();
        await zip.loadAsync(file);
        const nodes = [] as any;
        const files = [] as any;
        zip.forEach((relativePath: string, file: any) => {
            if (!/\.json$/.test(file.name)) {
                return;
            }
            files.push(file);
        });
        for (const file of files) {
            const unzipedFile = await zip.file(file.name).async('string');
            const node = JSON.parse(unzipedFile);
            if (!(node.id && node.version !== undefined && node.graphId)) {
                return;
            }
            nodes.push(node);
        }
        return nodes;
    },
    drop(e: DragEvent) {
        if (!e.dataTransfer) { return; }
        if (e.dataTransfer.files.length > 0) {
            e.preventDefault();
            for (let x = 0; x < e.dataTransfer.files.length; x += 1) {
                const file = e.dataTransfer.files[x];
                if (file.type !== this.jsonMimeType
                    && file.type !== this.zipMimeType) {
                    continue;
                }
                const reader = new FileReader();
                reader.onload = async (ev: any) => {
                    let results = file.type === this.zipMimeType
                        ? (await this.unzip(file))
                        : [JSON.parse(ev.target.result)];
                    for (const result of results) {
                        this.addDroppedItem({
                            x: e.clientX,
                            y: e.clientY,
                            ...{
                                id: newId(),
                                lastUpdate: file.lastModified,
                                description: file.name,
                                name: file.name.split("_")[0],
                                icon: result.properties.icon,
                                item: result,
                                version: result.version,
                                type: "droppedFile",
                            },
                        });
                    }
                };
                reader.readAsText(file);
            }
            return;
        }
        const jsonData = e.dataTransfer.getData(this.jsonMimeType);
        const plasticData = e.dataTransfer.getData(this.nodeMimeType);
        if (plasticData) {
            const data = JSON.parse(plasticData);
            if (data.type === "newNode") {
                this.createNewNode({
                    x: e.clientX,
                    y: e.clientY,
                });
                return;
            }
            this.addItem({
                x: e.clientX,
                y: e.clientY,
                ...data,
            });
        } else if (jsonData) {
            const data = JSON.parse(jsonData);
            this.importItem({
                item: data,
            });
        }
    },
    copyNodes(nodes: Node[]) {
        nodes = JSON.parse(JSON.stringify(nodes));
        const nodeIds = nodes.map(v => v.id);
        // get rid of connectors that point to nodes not in this array
        nodes.forEach((node) => {
            node.edges.forEach((edge) => {
                const dropConnectors = [] as any[];
                edge.connectors.forEach((connector) => {
                    if (nodeIds.indexOf(connector.nodeId) === -1) {
                        dropConnectors.push(connector);
                    }
                });
                dropConnectors.forEach((connector) => {
                    edge.connectors.splice(edge.connectors.indexOf(connector), 1);
                });
            });
        });
        return nodes;
    },
    evCut(e: any) {
        if (!this.isGraphTarget(e)
            || /dont-propagate-copy/.test(e.target.className)
            || this.selectedNodes.length === 0
            || /input|textarea/i.test(e.target.tagName)) {
            return;
        }
        console.warn("Clipboard cut captured by graph editor");
        e.clipboardData.setData(this.nodeMimeType, JSON.stringify(this.copyNodes(this.selectedNodes), null, "\t"));
        this.deleteSelected();
        e.preventDefault();
    },
    evCopy(e) {
        if (!this.isGraphTarget(e)
                || /dont-propagate-copy/.test(e.target.className)
                || this.selectedNodes.length === 0
                || /input|textarea/i.test(e.target.tagName)) {
            return;
        }
        console.warn("Clipboard copy captured by graph editor");
        e.clipboardData.setData(this.nodeMimeType, JSON.stringify(this.copyNodes(this.selectedNodes), null, "\t"));
        e.preventDefault();
    },
    evPaste(e: any) {
        if (!this.isGraphTarget(e)
            || /dont-propagate-copy/.test(e.target.className)
            || /input|textarea/i.test(e.target.tagName)) {
            return;
        }
        console.warn("Clipboard paste captured by graph editor");
        const data = e.clipboardData.getData(this.nodeMimeType);
        this.tryPasteNodeString(data);
        e.preventDefault();
    },
    tryPasteNodeString(data: any) {
        const msg = "The text pasted onto the graph does not appear to be node data.";
        let nodes;
        const er = () => {
            this.raiseError(msg);
            console.warn(msg);
        };
        try {
            nodes = JSON.parse(data);
        } catch(err) {
            console.error(err);
            return er();
        }
        if (!Array.isArray(nodes)) {
            return er();
        }
        for (var x = 0; x < nodes.length; x += 1) {
            if(!this.validateNode(nodes[x])){
                return er();
            }
        }
        this.pasteNodes(nodes);
    },
    validateNode(node: any) {
        if (
            !node.id ||
            !node.edges ||
            !Array.isArray(node.edges) ||
            typeof node.properties !== "object" ||
            node.properties.x === undefined ||
            node.properties.y === undefined ||
            node.properties.z === undefined ||
            typeof node.template !== "object" ||
            node.template.set === undefined ||
            node.template.vue === undefined
        ) {
            return false;
        }
        return true;
    },
    pasteNodes(nodes: Node[], name: string = "Paste") {
        const idMap:{
            [key: string]: string;
        } = {};
        // gather IDs for nodes, groups, and connectors
        nodes.forEach((v: Node) => {
            // node.ids
            idMap[v.id] = idMap[v.id] || newId();
            if (v.id === v.url) {
                v.id = idMap[v.id];
                v.url = v.id;
            } else {
                v.id = idMap[v.id];
            }
            v.graphId = this.graph.id;
            v.version = this.graph.version;
            for (let x = 0; x < v.properties.groups.length; x += 1) {
                const groupId = v.properties.groups[x];
                // group ids
                idMap[groupId] = idMap[groupId] || newId();
                v.properties.groups[x] = idMap[groupId];
            }
            v.edges.forEach((edge: any) => {
                edge.connectors.forEach((c: any) => {
                    // connector ids
                    idMap[c.id] = idMap[c.id] || newId();
                    c.id = idMap[c.id];
                    // connected nodes
                    idMap[c.nodeId] = idMap[c.nodeId] || newId();
                    c.nodeId = idMap[c.nodeId];
                    c.graphId = this.graph.id;
                    c.version = this.graph.version;
                });
            });
        });
        this.graphSnapshot.nodes = [
            ...this.graphSnapshot.nodes,
            ...nodes,
        ];
        this.selectedNodes = nodes;
        this.updateGraphFromSnapshot(name);
    }
} as ThisType<any>;
