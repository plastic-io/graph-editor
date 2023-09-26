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

export  async function loadScripts(scripts: string[]): Promise<void> {
  console.info('Loading scripts', scripts);
  const promises = scripts.filter((s: string) => !!s).map((src: string) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = false;
      script.src = src;
      script.onload = resolve;
      script.onerror = (err) => {
        console.error(`Error loading script (src: ${src}) from preferences: ${err}`);
      };
      document.head.appendChild(script);
    });
  });
  await Promise.all(promises);
}
