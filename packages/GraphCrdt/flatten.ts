/**
 * Linked graphs, flattened (plan §4.2, PB-046).
 *
 * A node can carry another graph. Before anything runs, that arrangement has
 * to become one flat set of nodes: the scheduler routes values along
 * connectors between node ids and knows nothing about nesting. Flattening is
 * three moves, repeated inward:
 *
 *   1. a connector that pointed **at** the host node now points at the inner
 *      node that stands for the matching input;
 *   2. the connectors leaving the host node's output edge are moved onto the
 *      inner node that stands for that output;
 *   3. the inner nodes join the flat set, and the host node stays behind as an
 *      empty shell nothing routes to.
 *
 * Both runtimes have carried a copy of this (the editor's orchestrator and the
 * Rust prototype's loader), which is how they drifted: the Rust port compares
 * a connector against the node that owns it rather than the host node, and
 * returns out of the whole walk where it means to skip one edge. This is the
 * one implementation both domains use, and it fixes three things the copies
 * shared:
 *
 * **A graph that links itself never terminates.** The walk carries the path of
 * graphs it came through; meeting one already on that path is reported and
 * that link is left unflattened, rather than recursing until the stack ends.
 * This is detection, not recursion: running a graph inside itself needs each
 * instance to have its own state, which flattening cannot give it, and
 * pretending otherwise is how you get a program that halts for the wrong
 * reason.
 *
 * **The same subgraph used twice collided.** Inner node ids are qualified by
 * the chain of host nodes they came through (`host/inner`), so two instances
 * of one subgraph are two sets of nodes, and each node says which instance it
 * is (`instancePath`) so an observation can too.
 *
 * **Inputs were matched by position, not by name.** A host node's input is
 * rewired to the inner node that its own field names, so a subgraph with more
 * than one input is wired the way it was drawn.
 */

export interface FlattenWarning {
    code: "LINKED_GRAPH_CYCLE" | "LINKED_GRAPH_MISSING" | "LINKED_GRAPH_TOO_DEEP";
    /** The host node carrying the link, as it is named in the flat set. */
    nodeId: string;
    graphId?: string;
    /** The graphs this walk came through, outermost first. */
    path: string[];
    message: string;
}

export interface FlattenInstance {
    /** The host node, as named in the flat set. */
    nodeId: string;
    graphId: string;
    instancePath: string[];
}

export interface FlattenResult {
    graph: any;
    warnings: FlattenWarning[];
    instances: FlattenInstance[];
}

export interface FlattenOptions {
    /**
     * The graph a linked node carries. The default answers with the copy the
     * node holds; a server resolves it from the component layout or the
     * document store instead.
     */
    resolve?: (node: any, path: string[]) => Promise<any | null> | any | null;
    /** How deep the nesting may go before it is reported and stopped. */
    maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 8;

/** A node's id within one instance: the chain of hosts it came through. */
export function qualify(id: string, instancePath: string[]): string {
    return instancePath.length ? `${instancePath.join("/")}/${id}` : id;
}

const defaultResolve = (node: any) => (node && node.linkedGraph && node.linkedGraph.graph) || null;

/**
 * One flat graph, and what could not be flattened.  The graph passed in is not
 * modified: everything is copied on the way out, because the caller's copy is
 * usually the editor's live document.
 */
export async function flattenLinkedGraphs(graph: any, options: FlattenOptions = {}): Promise<FlattenResult> {
    const resolve = options.resolve || defaultResolve;
    const maxDepth = options.maxDepth || DEFAULT_MAX_DEPTH;
    const warnings: FlattenWarning[] = [];
    const instances: FlattenInstance[] = [];
    const nodes: any[] = [];
    /** For each host: which inner node a value arriving on one of its fields is really for. */
    const waysIn = new Map<string, Map<string, { nodeId: string; field: string }>>();
    /** For each host: which inner node really produces what leaves one of its fields. */
    const waysOut = new Map<string, Map<string, { nodeId: string; field: string }>>();
    const rootGraphId = String((graph && graph.id) || "");

    async function walk(current: any, instancePath: string[], graphPath: string[]): Promise<void> {
        for (const node of ((current && current.nodes) || [])) {
            const here = qualify(node.id, instancePath);
            nodes.push(cloneNode(node, instancePath, rootGraphId));
            if (!node.linkedGraph) {
                continue;
            }
            const innerId = String((node.linkedGraph && node.linkedGraph.id)
                || (node.linkedGraph && node.linkedGraph.graph && node.linkedGraph.graph.id) || "");
            if (innerId && graphPath.indexOf(innerId) !== -1) {
                warnings.push({
                    code: "LINKED_GRAPH_CYCLE", nodeId: here, graphId: innerId, path: graphPath.concat([innerId]),
                    message: `${innerId} contains itself through ${graphPath.concat([innerId]).join(" → ")}; a graph cannot be run inside itself`,
                });
                continue;
            }
            if (graphPath.length > maxDepth) {
                warnings.push({
                    code: "LINKED_GRAPH_TOO_DEEP", nodeId: here, graphId: innerId, path: graphPath,
                    message: `linked graphs are nested more than ${maxDepth} deep here; the rest is left as it is`,
                });
                continue;
            }
            const inner = await resolve(node, graphPath);
            if (!inner || !Array.isArray(inner.nodes)) {
                warnings.push({
                    code: "LINKED_GRAPH_MISSING", nodeId: here, graphId: innerId, path: graphPath,
                    message: `the graph ${innerId || "this node links to"} could not be loaded, so nothing it contains will run`,
                });
                continue;
            }
            const childPath = instancePath.concat([node.id]);
            const fields = (node.linkedGraph && node.linkedGraph.fields) || {};
            waysIn.set(here, mapFields(fields.inputs, childPath));
            waysOut.set(here, mapFields(fields.outputs, childPath));
            instances.push({ nodeId: here, graphId: innerId || inner.id, instancePath: childPath });
            await walk(inner, childPath, graphPath.concat([innerId || inner.id]));
        }
    }

    await walk(graph, [], [String(graph && graph.id)]);

    /**
     * A host may stand in front of another host, so following one redirect is
     * not enough: the value that arrives at the outermost shell is for whatever
     * node is at the end of that chain.  The guard is the chain itself — a
     * redirect that comes back to a host already followed would be the cycle
     * this refuses to flatten.
     */
    const follow = (map: Map<string, Map<string, { nodeId: string; field: string }>>, start: { nodeId: string; field: string }) => {
        let at = { ...start };
        const seen = new Set<string>();
        while (map.has(at.nodeId) && !seen.has(at.nodeId)) {
            seen.add(at.nodeId);
            const ways = map.get(at.nodeId)!;
            const next = ways.get(at.field) || (ways.size === 1 ? ways.values().next().value : undefined);
            if (!next) {
                break;                                   // this shell says nothing about that field
            }
            at = { nodeId: next.nodeId, field: next.field || at.field };
        }
        return at;
    };

    // What pointed at a shell now points at the node that does the work.
    nodes.forEach((node: any) => {
        (node.edges || []).forEach((edge: any) => {
            (edge.connectors || []).forEach((connector: any) => {
                const target = follow(waysIn, { nodeId: connector.nodeId, field: connector.field });
                connector.nodeId = target.nodeId;
                connector.field = target.field;
            });
        });
    });
    // What left a shell now leaves the node that produced it.
    const byId = new Map<string, any>(nodes.map((n: any) => [n.id, n]));
    waysOut.forEach((_ways, hostId) => {
        const host = byId.get(hostId);
        if (!host) {
            return;
        }
        (host.edges || []).forEach((edge: any) => {
            if (!edge.connectors || !edge.connectors.length) {
                return;
            }
            const source = follow(waysOut, { nodeId: hostId, field: edge.field });
            const producer = byId.get(source.nodeId);
            if (!producer || producer === host) {
                return;
            }
            let innerEdge = (producer.edges || []).find((e: any) => e.field === source.field);
            if (!innerEdge) {
                innerEdge = { field: source.field, connectors: [] };
                producer.edges = (producer.edges || []).concat([innerEdge]);
            }
            innerEdge.connectors = (innerEdge.connectors || []).concat(edge.connectors);
            edge.connectors = [];
        });
    });

    return { graph: { ...graph, nodes }, warnings, instances };
}

/** One shell's fields, with the inner nodes named as they are in the flat set. */
function mapFields(fields: Record<string, any> | undefined, childPath: string[]): Map<string, { nodeId: string; field: string }> {
    const out = new Map<string, { nodeId: string; field: string }>();
    Object.keys(fields || {}).forEach((hostField) => {
        const target = (fields as any)[hostField];
        if (target && target.id) {
            out.set(hostField, { nodeId: qualify(target.id, childPath), field: target.field || hostField });
        }
    });
    return out;
}

/**
 * A node as it appears in the flat set: its own id qualified, its connectors
 * with it, and everything stamped with the graph that is actually running.
 * The scheduler resolves a connector that names another graph by loading that
 * graph, which is the last thing a flattened arrangement wants — there is only
 * one graph now, and these are its nodes.
 */
function cloneNode(node: any, instancePath: string[], rootGraphId: string): any {
    const copy = {
        ...node,
        id: qualify(node.id, instancePath),
        graphId: rootGraphId,
        edges: ((node.edges || []) as any[]).map((edge: any) => ({
            ...edge,
            connectors: ((edge.connectors || []) as any[]).map((connector: any) => ({
                ...connector,
                nodeId: qualify(connector.nodeId, instancePath),
                graphId: rootGraphId,
            })),
        })),
    };
    if (instancePath.length && node.graphId && node.graphId !== rootGraphId) {
        copy.originalGraphId = node.graphId;
    }
    if (instancePath.length) {
        // Which instance of a subgraph this node belongs to, so an observation
        // can say which one ran.
        copy.instancePath = instancePath.slice();
        copy.originalId = node.id;
    }
    if (node.linkedGraph) {
        // The shell stays so anything naming it still finds something, but it
        // carries no graph any more and nothing routes to it.
        copy.loadedGraph = node.linkedGraph;
        delete copy.linkedGraph;
    }
    return copy;
}
