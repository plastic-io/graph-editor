/**
 * Shared Yjs schema for Plastic-IO graphs.
 *
 * This module is imported by BOTH the browser editor and the AWS Lambda graph
 * server.  It must stay free of Vue, Pinia, DOM and Node built-ins.
 *
 * Document layout
 * ---------------
 *
 *   doc.getMap('graph')
 *     id          : string                      (scalar, set once)
 *     url         : string                      (scalar, last writer wins)
 *     version     : number                      (scalar, see note below)
 *     properties  : Y.Map
 *        template : Y.Text                      (character level merge)
 *        scripts  : Y.Text                      (character level merge)
 *        ...      : scalars
 *     nodes       : Y.Map  keyed by node id     (NOT an array, so that
 *                                                concurrent inserts and
 *                                                deletes never collide)
 *     meta        : Y.Map
 *        schemaVersion : number
 *
 *   node (a Y.Map inside graph.nodes)
 *     id, graphId, url, artifact, version       scalars
 *     data, linkedGraph, linkedNode             opaque JSON, replaced whole
 *     properties : Y.Map
 *        presentation : Y.Map                   scalars
 *        groups       : Y.Array<string>
 *        inputs       : Y.Array<Y.Map>          keyed by name
 *        outputs      : Y.Array<Y.Map>          keyed by name
 *        scripts      : Y.Text
 *        ...          : scalars
 *     edges      : Y.Map keyed by edge field
 *        <field> : Y.Map
 *           field      : string
 *           connectors : Y.Array<Y.Map>         keyed by connector id
 *     template   : Y.Map
 *        set : Y.Text
 *        vue : Y.Text
 *
 * A note on `version`
 * -------------------
 * `version` is kept as a plain last-writer-wins scalar rather than being
 * modelled as a CRDT counter.  It is a human facing label used for artifact
 * naming and the rewind display, never for conflict resolution, and treating
 * it as a counter would mean inventing a counter CRDT for no behavioural gain.
 * In server backed sessions the checkpointer is the authoritative writer.  In
 * local only sessions the committing client bumps it, exactly as the pre-CRDT
 * code did.
 *
 * Node array order
 * ----------------
 * `graph.nodes` is a map, so it has no inherent order, but the scheduler and
 * the exported JSON both want an array.  Order is derived deterministically
 * from `properties.createdOn` then `id`, which every peer computes the same
 * way.  Render order is separately controlled by
 * `properties.presentation.sort`, so nothing user visible depends on the
 * array position.
 */

/**
 * 2 since a graph can carry what this system asks of it: component pins
 * (`properties.component`), where a node runs (`placement`), how it is
 * contained (`containment`), what it may do (`capabilities`) and what it
 * offers (`provides`).  A reader accepts 1 and 2; only a version beyond this
 * is refused, because it would mean the document knows something the reader
 * does not (plan §9.5).
 */
export const SCHEMA_VERSION = 2;

/** Root key of the graph map inside the Y.Doc. */
export const ROOT_KEY = "graph";

/** Fields on the graph root that hold collaborative text. */
export const GRAPH_TEXT_PROPERTIES = ["template", "scripts"];

/** Fields on `node.properties` that hold collaborative text. */
export const NODE_TEXT_PROPERTIES = ["scripts"];

/** Fields on `node.template` that hold collaborative text. */
export const NODE_TEMPLATE_TEXT_FIELDS = ["set", "vue"];

/**
 * Node fields stored as opaque JSON and replaced as a unit.  These are either
 * runtime scratch space (`data`) or immutable imported artifacts
 * (`linkedGraph`, `linkedNode`) where a merge of the interior would be
 * meaningless.
 */
export const NODE_OPAQUE_FIELDS = ["data", "linkedGraph", "linkedNode"];

/** Keys on `node.properties` that are structured rather than scalar. */
export const NODE_PROPERTY_CONTAINERS = [
  "presentation",
  "groups",
  "inputs",
  "outputs",
];

/** Identity of one collaborator, carried on the awareness channel. */
export interface AwarenessState {
  user: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    color: string;
  };
  cursor?: { x: number; y: number } | null;
  selection?: { nodes: string[]; connectors: string[] };
  presentation?: boolean;
}

/** Wire envelope used to carry Yjs binary protocol messages over the
 * API Gateway WebSocket, which routes on a JSON `action` field. */
export interface YjsEnvelope {
  action: "yjs";
  /** Which graph document this message belongs to. */
  graphId: string;
  /** `sync` for the y-protocols sync protocol, `awareness` for presence. */
  kind: "sync" | "awareness";
  /** base64 encoded protocol payload. */
  payload: string;
  /** Label for the action, shown in the history and rewind panels. */
  description?: string;
  /** Update encoding, so a format mismatch is caught rather than applied. */
  format?: number;
  /** Opaque per connection id, echoed back so a sender can drop its own
   * broadcast without relying on document level heuristics. */
  origin?: string;
}
