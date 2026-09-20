/**
 * Direct writes into the CRDT document for continuous gestures.
 *
 * Saving through the snapshot reconciler is right for discrete actions, but a
 * drag produces a position every frame and reconciling the whole graph that
 * often is wasteful.  These actions write the handful of fields that changed
 * straight into the document, which also means a drag is visible to everyone
 * else as it happens instead of jumping into place on mouse up.
 *
 * Yjs merges changes that land within its capture window into a single undo
 * step, so a whole drag still undoes in one go.
 */
export default {
  /**
   * Move nodes to new positions.  `positions` carries only the nodes that
   * actually moved.
   */
  setNodePositions(
    positions: { id: string; x: number; y: number }[],
    presentation: boolean,
  ) {
    // Update the working snapshot first so the canvas follows the pointer
    // without waiting on a round trip through the document.
    positions.forEach((position) => {
      const node = this.graphSnapshot.nodes.find((n: any) => n.id === position.id);
      if (!node) {
        return;
      }
      const target = presentation ? node.properties.presentation : node.properties;
      target.x = position.x;
      target.y = position.y;
    });

    if (!this.crdtSession) {
      return;
    }

    this.crdtSession.transactLocal(
      "Move Nodes",
      (root: any) => {
        const nodes = root.get("nodes");
        if (!nodes) {
          return;
        }
        positions.forEach((position) => {
          const node = nodes.get(position.id);
          if (!node) {
            return;
          }
          const properties = node.get("properties");
          if (!properties) {
            return;
          }
          const target = presentation ? properties.get("presentation") : properties;
          if (!target) {
            return;
          }
          if (target.get("x") !== position.x) {
            target.set("x", position.x);
          }
          if (target.get("y") !== position.y) {
            target.set("y", position.y);
          }
        });
      },
      "move-nodes",
    );
  },

  /** Close off a gesture so the next action starts its own undo step. */
  endNodeDrag(description = "Move Nodes") {
    if (this.crdtSession) {
      this.crdtSession.endLiveEdit();
      return;
    }
    this.updateGraphFromSnapshot(description);
  },
} as ThisType<any>;
