import {Bezier} from "bezier-js"; // eslint-disable-line
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import colors from "vuetify/lib/util/colors";
const lastViewPos = {x: 0, y: 0, k: 1};
export default function bezierDraw(connector: any): void {
    const ctx = connector.ctx;
    function getColor(key: string) {
        return (colors as {[key: string]: any})[key].base;
    }
    function drawShadow(curve: any): void {
        ctx.save(); // Save the current state to restore after drawing the shadow
        ctx.strokeStyle = 'rgba(127, 127, 127, 1)'; // Shadow color: black with 50% opacity
        ctx.lineWidth = connector.preferences.appearance.connectors.lineWidth + 2; // Slightly larger to ensure it appears under the main line
        // ctx.translate(2, 2); // Offset the shadow by 2 pixels right and 2 pixels down
        ctx.globalCompositeOperation = "exclusion";
        // Draw the shadow curve
        drawCurve(curve);

        ctx.restore(); // Restore the state to draw the main line
    }

    function visualizeLUT(lut: any) {
        lut.forEach((point: any) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI); // Draw small circle for each point
            ctx.fillStyle = '#FF000011';
            ctx.fill();
        });
    }

    let strokeStyle = getColor(connector.preferences.appearance.connectors.strokeStyle) || "blue";
    if (connector.watchConnectors.map((i: {id: string}) => i.id).indexOf(connector.connector.id) !== -1) {
        strokeStyle = getColor(connector.preferences.appearance.connectors.watchStrokeStyle) || "blue";
    }
    if (connector.active) {
        strokeStyle = getColor(connector.preferences.appearance.connectors.activityStrokeStyle) || "blue";
    }
    if (connector.errored) {
        strokeStyle = getColor(connector.preferences.appearance.connectors.errorStrokeStyle) || "blue";
    }
    if (connector.selected) {
        strokeStyle = getColor(connector.preferences.appearance.connectors.selectedStrokeStyle) || "blue";
    }
    if (connector.hovered) {
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
            x: 600,
            y: 600,
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
        const isAddingFromInput = connector.addingConnector
            && connector.addingConnector.type === 'input'
            && connector.addingConnector.connector.id === connector.connector.id;
        const ltr = isMoving ? connector.ltrPct > 0.5 : !isAddingFromInput;
        const inSrc = isAddingFromInput ? connector.addingConnector : connector.input;
        if (inSrc.field && ((connector.output.field && !connector.output.field.visible) || !inSrc.field.visible)) {
            return;
        }
        if (!inSrc.field) {
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
        connector.x = x - 200;
        connector.y = y;
        connector.width = width + 400;
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
            x: 12,
            y: 7,
        };
        const eco = {
            x: -3,
            y: 7,
        }


        const distance = Math.hypot(end.x - start.x, end.y - start.y);
        const controlPointFactor = 0.5; // Adjust this factor to increase or decrease the curvature
        const controlPointOffset = distance * controlPointFactor;

        const asymmetryFactor = 1; // Adjust this to make one side of the curve more pronounced


        const curve = new Bezier(  // eslint-disable-line
            {x: start.x + co.x, y: start.y + co.y},
            {x: start.x + controlPointOffset + co.x, y: start.y + co.y},
            {x: end.x - controlPointOffset - eco.x, y: end.y + eco.y},
            {x: end.x - eco.x, y: end.y + eco.y},
        );
        drawShadow(curve);
        drawCurve(curve);
        const cStart = curve.get(0);
        const cEnd = curve.get(1);
        const midPointSize = connector.preferences.showConnectorActivity ? 4 : 4;
        const middlePoint = curve.get(0.5);
        const middlePointColor = getColor(connector.preferences.appearance.connectors.controlFillStyle);
        arc(cStart.x, cStart.y, 5, 0, 2 * Math.PI, getColor(connector.preferences.appearance.connectors.controlFillStyle) || "blue");
        arc(cEnd.x, cEnd.y, 5, 0, 2 * Math.PI, getColor(connector.preferences.appearance.connectors.controlFillStyle) || "blue");
        arc(middlePoint.x, middlePoint.y, midPointSize, 0, 2 * Math.PI, middlePointColor || "blue");

        // report to store
        const len: number = curve.length();
        const lut = curve.getLUT(len / (14 / connector.view.k));

        // used to help debug LUT collisions
        // visualizeLUT(lut);

        ctx.setTransform(1, 0, 0, 1, 0, 0);

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
