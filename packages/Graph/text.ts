import { ROOT_KEY } from "@plastic-io/graph-crdt";

/**
 * Handles on the collaborative text inside the document.
 *
 * Code lives in the document as Y.Text rather than as a plain string, so two
 * people editing the same node's template merge character by character instead
 * of one of them losing their work.  These accessors hand the underlying type
 * to the code editor so it can bind to it directly.
 */
export default {
  /** The Y.Text behind one of a node's templates, or null. */
  nodeTemplateText(nodeId: string, field: string) {
    if (!this.crdtSession || !nodeId || !field) {
      return null;
    }
    const nodes = this.crdtSession.doc.getMap(ROOT_KEY).get("nodes");
    if (!nodes) {
      return null;
    }
    const node = nodes.get(nodeId);
    if (!node) {
      return null;
    }
    const template = node.get("template");
    const text = template && template.get(field);
    return text && typeof text.toString === "function" && text.doc ? text : null;
  },

  /** The Y.Text behind the graph's own presentation template, or null. */
  graphTemplateText() {
    if (!this.crdtSession) {
      return null;
    }
    const properties = this.crdtSession.doc.getMap(ROOT_KEY).get("properties");
    const text = properties && properties.get("template");
    return text && typeof text.toString === "function" && text.doc ? text : null;
  },

  /** The presence channel, so the editor can show other people's cursors. */
  collaborationAwareness() {
    const provider = this.presenceProvider();
    return provider ? provider.awareness || null : null;
  },
} as ThisType<any>;
