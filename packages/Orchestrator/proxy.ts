export type Path = (string | number)[];
export const createDeepProxy = (obj: any, path: Path = [], handler: (path: Path, value: any) => void): any => {
  return new Proxy(obj, {
    set(target: any, key: string | number, value: any): boolean {
      const newPath: Path = [...path, key];
      handler(newPath, value);
      target[key] = value;
      return true;
    },
    get(target: any, key: string | number): any {
      if (typeof target[key] === "object" && target[key] !== null) {
        return createDeepProxy(target[key], [...path, key], handler);
      }
      return target[key];
    },
  } as any);
};
