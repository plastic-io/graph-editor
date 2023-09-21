import {Bezier} from "bezier-js"; // eslint-disable-line
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import colors from "vuetify/lib/util/colors";
const lastViewPos = {x: 0, y: 0, k: 1};
export default function bezierDraw(connector: any): void {
    const ctx = connector.ctx;
    function getColor(key: string) {
        return (colors as {[key: string]: any})[key].base;
    }
    let strokeStyle = getColor(connector.preferences.appearance.connectors.strokeStyle) || "blue";
    if (connector.watchConnectors.map((i: {id: string}) => i.id).indexOf(connector.connector.id) !== -1) {
        strokeStyle = getColor(connector.preferences.appearance.connectors.watchStrokeStyle) || "blue";
    }
    if (connector.active) {
        strokeStyle = getColor(connector.preferences.appearance.connectors.activityStrokeStyle) || "blue";
    }
    if (connector.errorConnectors.map((i: {id: string}) => i.id).indexOf(connector.connector.id) !== -1) {
        strokeStyle = getColor(connector.preferences.appearance.connectors.errorStrokeStyle) || "blue";
    }
    if (connector.selectedConnectors.map((i: {id: string}) => i.id).indexOf(connector.connector.id) !== -1) {
        strokeStyle = getColor(connector.preferences.appearance.connectors.selectedStrokeStyle) || "blue";
    }
    if (connector.hoveredConnector && connector.hoveredConnector.connector.id === connector.connector.id) {
        strokeStyle = getColor(connector.preferences.appearance.connectors.hoverStrokeStyle) || "blue";
    }
    function drawCurve(curve: any): void { // eslint-disable-line
        ctx.beginPath();
        var p = curve.points;
        ctx.moveTo(p[0].x, p[0].y);
        ctx.bezierCurveTo(
            p[1].x, p[1].y,
            p[2].x, p[2].y,
            p[3].x, p[3].y
        );
        ctx.stroke();
        ctx.closePath();
    }
    function arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, fillStyle: string) {
        ctx.beginPath();
        ctx.fillStyle = fillStyle;
        ctx.arc(x, y, radius, startAngle, endAngle);
        ctx.fill();
        ctx.closePath();
    }
    function draw(): any {
        const padding = {  // eslint-disable-line
            x: 300,
            y: 300,
        };
        const el = document.getElementById("node-" + connector.node.id);
        if (!el) {
            // it should show up soon
            return setTimeout(draw, 100);
        }
        // I make no apologies for this.  I did what I had to do.
        const dragDeadZone = connector.preferences.appearance.connectors.dragDeadZone;
        const pastDeadZone = connector.translating.mouse ? (Math.abs(connector.mouse.x - connector.translating.mouse.x) > dragDeadZone
            || Math.abs(connector.mouse.y - connector.translating.mouse.y) > dragDeadZone) : false;
        const isAdding = connector.addingConnector && connector.addingConnector.connector.id === connector.connector.id && pastDeadZone;
        const isMoving = connector.movingConnector && connector.movingConnector.connector.id === connector.connector.id && pastDeadZone;
        const isMovingOrAdding = isAdding || isMoving;
        const isAddingFromInput = connector.addingConnector && connector.addingConnector.type === 'input';
        const ltr = isMoving ? connector.ltrPct > 0.5 : !isAddingFromInput;
        const inSrc = isAddingFromInput ? connector.addingConnector : connector.input;
        if (inSrc.field && ((connector.output.field && !connector.output.field.visible) || !inSrc.field.visible)) {
            return;
        }
        const elOutPort = connector.output.field ? document.getElementById(`node-output-${connector.output.node.id}-${connector.output.field.name}`) : null;
        const elInPort = inSrc.node ? document.getElementById(`node-input-${inSrc.node.id}-${inSrc.field.name}`) : null;
        // if a graph element is still loading, it might not have io yet
        if ((ltr && !isMovingOrAdding && !elInPort) || (!ltr && !isMovingOrAdding && !elOutPort) ) {
            return;
            // setTimeout(draw, 100);
        }
        const elOutPortRect = elOutPort ? elOutPort.getBoundingClientRect() : {x: 0, y: 0,};
        const elInPortRect = elInPort ? elInPort!.getBoundingClientRect() : {x: 0, y: 0,};
        const inRect = {
            x: elInPortRect.x,
            y: elInPortRect.y,
        };
        const outRect = {
            x: elOutPortRect.x,
            y: elOutPortRect.y,
        };
        inRect.x = (inRect.x - connector.view.x) / connector.view.k;
        inRect.y = (inRect.y - connector.view.y) / connector.view.k;
        outRect.x = (outRect.x - connector.view.x) / connector.view.k;
        outRect.y = (outRect.y - connector.view.y) / connector.view.k;
        const mouseX = (connector.mouse.x - connector.view.x) / connector.view.k;
        const mouseY = (connector.mouse.y - connector.view.y) / connector.view.k;
        let x = Math.min(inRect.x, outRect.x) - (padding.x / 2);
        let y = Math.min(inRect.y, outRect.y) - (padding.y / 2);
        let width = (Math.max(inRect.x, outRect.x) - Math.min(inRect.x, outRect.x)) + padding.x;
        let height = (Math.max(inRect.y, outRect.y) - Math.min(inRect.y, outRect.y)) + padding.y;
        if (isMovingOrAdding) {
            // 50 px offset to ensure bezier arc is within the width of the canvas
            x = Math.min(x, mouseX - 50);
            y = Math.min(y, mouseY);
            width = Math.max(width, width + Math.abs(mouseX));
            height = Math.max(height, height + Math.abs(mouseY));
        }
        connector.x = x;
        connector.y = y;
        connector.width = width;
        connector.height = height;
        const start = {
            x: !ltr && isMovingOrAdding ? mouseX : outRect.x,
            y: !ltr && isMovingOrAdding ? mouseY : outRect.y
        };
        const end = {
            x: ltr && isMovingOrAdding ? mouseX : inRect.x,
            y: ltr && isMovingOrAdding ? mouseY : inRect.y
        };
        ctx.clearRect(0, 0, connector.width, connector.height);
        ctx.translate(-connector.x, -connector.y);
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = connector.preferences.appearance.connectors.lineWidth;
        const co = {// connector offset to center inputs and outputs
            x: 0,
            y: 5, 
        };
        const curve = new Bezier(  // eslint-disable-line
            {x: start.x + co.x, y: start.y + co.y},
            {x: start.x + 200 + co.x, y: start.y + co.y},
            {x: end.x - 200 - co.x, y: end.y + co.y},
            {x: end.x - co.x, y: end.y + co.y},
        );
        drawCurve(curve);
        const cStart = curve.get(0);
        const cEnd = curve.get(1);
        const middlePoint = curve.get(0.5);
        arc(cStart.x, cStart.y, 5, 0, 2 * Math.PI, getColor(connector.preferences.appearance.connectors.controlFillStyle) || "blue");
        arc(cEnd.x, cEnd.y, 5, 0, 2 * Math.PI, getColor(connector.preferences.appearance.connectors.controlFillStyle) || "blue");
        arc(middlePoint.x, middlePoint.y, 5, 0, 2 * Math.PI, getColor(connector.preferences.appearance.connectors.controlFillStyle) || "blue");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // report to store
        const len: number = curve.length();
        const lut = curve.getLUT(len / 2);
        if ((lastViewPos.x !== connector.view.x
                || lastViewPos.x !== connector.view.x
                || lastViewPos.k !== connector.view.k)) {
            lastViewPos.x = connector.view.x;
            lastViewPos.y = connector.view.y;
            lastViewPos.k = connector.view.k;
        }
        if (!connector.addingConnector && !connector.movingConnector) {
            connector.graphStore.$patch({
                luts: {
                    [connector.connector.id]: {
                        connector: connector.connector,
                        input: connector.input,
                        output: connector.output,
                        node: connector.node,
                        lut,
                    }
                }
            });
        }
    }
    draw();
}
