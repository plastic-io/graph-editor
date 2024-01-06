const NUDGE_TIMEOUT = 2000;
let nudgeTimer = 0 as any;
export default {
    nudge(x: number, y: number) {
        this.selectedNodes.forEach((selectedNode: any) => {
            const node = this.graphSnapshot.nodes.find((v: any) => selectedNode.id === v.id);
            node.properties.x += x;
            node.properties.y += y;
        });
        clearTimeout(nudgeTimer);
        nudgeTimer = setTimeout(() => {
          this.updateGraphFromSnapshot("Nudge");
        }, NUDGE_TIMEOUT);
    },
    nudgeUp(offset: number) {
      this.nudge(0, -offset);
    },
    nudgeDown(offset: number) {
      this.nudge(0, offset);
    },
    nudgeLeft(offset: number) {
      this.nudge(-offset, 0);
    },
    nudgeRight(offset: number) {
      this.nudge(offset, 0);
    },
    setSelRelPropZ(num: number, name: string) {
        const selectedNodeIds = this.selectedNodes.map((v: any) => v.id);
        this.graphSnapshot.nodes.forEach((v: any) => {
            if (selectedNodeIds.indexOf(v.id) !== -1) {
                v.properties.z += num;
            }
        });
        this.updateGraphFromSnapshot(name);
    },
    bringForward() {
      this.setSelRelPropZ(1, "Send Forward");
    },
    sendBackward() {
      this.setSelRelPropZ(-1, "Send Backward");
    },
    bringToFront() {
      const maxNodeZ = Math.max.apply(null, this.graph.nodes.map((v: any) => v.properties.z));
      const selectedNodeIds = this.selectedNodes.map((v: any) => v.id);
      this.graphSnapshot.nodes.forEach((v: any) => {
          if (selectedNodeIds.indexOf(v.id) !== -1) {
              v.properties.z = maxNodeZ + 1;
          }
      });
      this.updateGraphFromSnapshot("Bring to Front");
    }, 
    sendToBack() {
      const minNodeZ = Math.min.apply(null, this.graph.nodes.map((v: any) => v.properties.z));
      const selectedNodeIds = this.selectedNodes.map((v: any) => v.id);
      this.graphSnapshot.nodes.forEach((v: any) => {
          if (selectedNodeIds.indexOf(v.id) !== -1) {
              v.properties.z = minNodeZ - 1;
          }
      });
      this.updateGraphFromSnapshot("Send to Back");
    },
} as ThisType<any>;
