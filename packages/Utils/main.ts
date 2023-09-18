/** Creates a new v4 UUID */
export function newId() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        var r = Math.random() * 16 | 0, v = c == "x" ? r : (r & 0x3 | 0x8); // eslint-disable-line
        return v.toString(16);
    });
}
export function deref(e: any) {
    return JSON.parse(JSON.stringify(e));
}
