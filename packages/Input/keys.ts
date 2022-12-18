const deleteKey = 46;
const dKeyCode = 68;
const gKeyCode = 71;
const zKeyCode = 90;
const openBraceKeyCode = 219;
const closeBraceKeyCode = 221;
const arrowUp = 38;
const arrowDown = 40;
const arrowLeft = 37;
const arrowRight = 39;
const dashKeyCode = 189;
const equalKeyCode = 187;
const backslashKeyCode = 220;
const graveKeyCode = 192;
const tabKeyCode = 9;
// const shiftKeyCode = 16;
// const metaKeyCode = 91;
// const spaceKeyCode = 32;
// const ctrlKeyCode = 17;
interface UIEvent {
    ctrlKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    keyCode: number;
    preventDefault: Function;
}
export const keys = (store: any, e: UIEvent) => {
    const keys = store.keys;
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;
    const locked = store.presentation || store.locked;
    if (keys[graveKeyCode] && alt) {
        store.graphCanvasStore.togglePresentation();
    }
    if (locked) {
        // keyboard shortcuts are disabled in presentation/locked mode
        return;
    }
    // zoom
    // BUG in chrome?: in key interface. - and + do not "keyup" when command is held down
    if (keys[equalKeyCode] && ctrl) {
        e.preventDefault();
        store.graphCanvasStore.zoom(0.10);
        keys[equalKeyCode] = false;
    }
    if (keys[dashKeyCode] && ctrl) {
        e.preventDefault();
        store.graphCanvasStore.zoom(-0.10);
        keys[dashKeyCode] = false;
    }
    if (keys[backslashKeyCode]) {
        store.graphCanvasStore.toggleSelectedNodePresentationMode();
    }
    // nudges
    if (keys[arrowUp]) {
        store.graphCanvasStore.nudgeUp(shift ? 50 : 10);
    }
    if (keys[arrowDown]) {
        store.graphCanvasStore.nudgeDown(shift ? 50 : 10);
    }
    if (keys[arrowLeft]) {
        store.graphCanvasStore.nudgeLeft(shift ? 50 : 10);
    }
    if (keys[arrowRight]) {
        store.graphCanvasStore.nudgeRight(shift ? 50 : 10);
    }
    // move z
    if (keys[closeBraceKeyCode] && ctrl && shift) {
        store.graphCanvasStore.bringToFront();
    } else if (keys[closeBraceKeyCode] && ctrl) {
        store.graphCanvasStore.bringForward();
    }
    if (keys[openBraceKeyCode] && ctrl && shift) {
        store.graphCanvasStore.sendToBack();
    } else if (keys[openBraceKeyCode] && ctrl) {
        store.graphCanvasStore.sendBackward();
    }
    // delete
    if (keys[deleteKey]) {
        store.graphCanvasStore.deleteSelected();
    }
    // group ungroup
    if (keys[gKeyCode] && ctrl && shift) {
        store.graphCanvasStore.ungroupSelected();
    } else if (keys[gKeyCode] && ctrl) {
        store.graphCanvasStore.groupSelected();
    }
    // undo / redo
    // BUG in chrome?: in key interface.  Z does not "keyup" when command is held down
    if (keys[zKeyCode] && ctrl && shift) {
        store.graphCanvasStore.redo();
        store.keys[zKeyCode] = false;
    } else if (keys[zKeyCode] && ctrl) {
        store.graphCanvasStore.undo();
        store.keys[zKeyCode] = false;
    }
    // duplicate
    if (keys[dKeyCode] && ctrl && shift) {
        e.preventDefault();
        store.graphCanvasStore.duplicateSelection();
    }
    if (keys[tabKeyCode]) {
        e.preventDefault();
        store.graphCanvasStore.togglePanelVisibility();
    }
}
