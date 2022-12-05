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
function keys(store: any, keys: {
        [key: string]: any; // tslint:disable-line
    }, e: UIEvent) {
    const state = store.state;
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;
    const locked = state.presentation || state.locked;
    if (keys[graveKeyCode] && alt) {
        store.togglePresentation(state);
    }
    if (locked) {
        // keyboard shortcuts are disabled in presentation/locked mode
        return;
    }
    // zoom
    // BUG in chrome?: in key interface. - and + do not "keyup" when command is held down
    if (keys[equalKeyCode] && ctrl) {
        e.preventDefault();
        store.zoom(state, 0.10);
        keys[equalKeyCode] = false;
    }
    if (keys[dashKeyCode] && ctrl) {
        e.preventDefault();
        store.zoom(state, -0.10);
        keys[dashKeyCode] = false;
    }
    if (keys[backslashKeyCode]) {
        store.toggleSelectedVectorPresentationMode(state);
    }
    // nudges
    if (keys[arrowUp]) {
        store.nudgeUp(state, shift ? 50 : 10);
    }
    if (keys[arrowDown]) {
        store.nudgeDown(state, shift ? 50 : 10);
    }
    if (keys[arrowLeft]) {
        store.nudgeLeft(state, shift ? 50 : 10);
    }
    if (keys[arrowRight]) {
        store.nudgeRight(state, shift ? 50 : 10);
    }
    // move z
    if (keys[closeBraceKeyCode] && ctrl && shift) {
        store.bringToFront(state);
    } else if (keys[closeBraceKeyCode] && ctrl) {
        store.bringForward(state);
    }
    if (keys[openBraceKeyCode] && ctrl && shift) {
        store.sendToBack(state);
    } else if (keys[openBraceKeyCode] && ctrl) {
        store.sendBackward(state);
    }
    // delete
    if (keys[deleteKey]) {
        store.deleteSelected(state);
    }
    // group ungroup
    if (keys[gKeyCode] && ctrl && shift) {
        store.ungroupSelected(state);
    } else if (keys[gKeyCode] && ctrl) {
        store.groupSelected(state);
    }
    // undo / redo
    // BUG in chrome?: in key interface.  Z does not "keyup" when command is held down
    if (keys[zKeyCode] && ctrl && shift) {
        store.redo(state);
        state.keys[zKeyCode] = false;
    } else if (keys[zKeyCode] && ctrl) {
        store.undo(state);
        state.keys[zKeyCode] = false;
    }
    // duplicate
    if (keys[dKeyCode] && ctrl && shift) {
        e.preventDefault();
        store.duplicateSelection(state);
    }
    if (keys[tabKeyCode]) {
        e.preventDefault();
        store.togglePanelVisibility(state);
    }
}
export function keyup(store: any, e: UIEvent) {
    store.state.keys[e.keyCode] = false;
    keys(store, store.state.keys, e);
}
export function keydown(store: any, e: UIEvent) {
    store.state.keys[e.keyCode] = true;
    keys(store, store.state.keys, e);
}
