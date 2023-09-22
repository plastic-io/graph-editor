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
        store.orchistratorStore.presentation = !store.orchistratorStore.presentation;
    }
    if (locked) {
        // keyboard shortcuts are disabled in presentation/locked mode
        return;
    }
    // zoom
    // BUG in chrome?: in key interface. - and + do not "keyup" when command is held down
    if (keys[equalKeyCode] && ctrl) {
        e.preventDefault();
        store.graphStore.zoom(0.10);
        keys[equalKeyCode] = false;
    }
    if (keys[dashKeyCode] && ctrl) {
        e.preventDefault();
        store.graphStore.zoom(-0.10);
        keys[dashKeyCode] = false;
    }
    if (keys[backslashKeyCode]) {
        store.graphStore.toggleSelectedNodePresentationMode();
    }
    // nudges
    if (keys[arrowUp]) {
        store.graphStore.nudgeUp(shift ? 50 : 10);
    }
    if (keys[arrowDown]) {
        store.graphStore.nudgeDown(shift ? 50 : 10);
    }
    if (keys[arrowLeft]) {
        store.graphStore.nudgeLeft(shift ? 50 : 10);
    }
    if (keys[arrowRight]) {
        store.graphStore.nudgeRight(shift ? 50 : 10);
    }
    // move z
    if (keys[closeBraceKeyCode] && ctrl && shift) {
        store.graphStore.bringToFront();
    } else if (keys[closeBraceKeyCode] && ctrl) {
        store.graphStore.bringForward();
    }
    if (keys[openBraceKeyCode] && ctrl && shift) {
        store.graphStore.sendToBack();
    } else if (keys[openBraceKeyCode] && ctrl) {
        store.graphStore.sendBackward();
    }
    // delete
    if (keys[deleteKey]) {
        store.graphStore.deleteSelected();
    }
    // group ungroup
    if (keys[gKeyCode] && ctrl && shift) {
        store.graphStore.ungroupSelected();
    } else if (keys[gKeyCode] && ctrl) {
        store.graphStore.groupSelected();
    }
    // undo / redo
    // BUG in chrome?: in key interface.  Z does not "keyup" when command is held down
    if (keys[zKeyCode] && ctrl && shift) {
        store.graphStore.redo();
        store.keys[zKeyCode] = false;
    } else if (keys[zKeyCode] && ctrl) {
        store.graphStore.undo();
        store.keys[zKeyCode] = false;
    }
    // duplicate
    if (keys[dKeyCode] && ctrl && shift) {
        e.preventDefault();
        store.graphStore.duplicateSelection();
    }
}
