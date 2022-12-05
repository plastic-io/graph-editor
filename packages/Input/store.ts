import { defineStore } from 'pinia';
export const useStore = defineStore('input', {
  state: () => ({
    name: 'input',
    keys: {} as Record<string, string>,
    mouse: {
      lmb: false,
      rmb: false,
      mmb: false,
      x: 0,
      y: 0,
      event: null,
    },
    buttonMap: {
      "0": "lmb",
      "2": "rmb",
      "1": "mmb"
    },
  }),
  actions: {
    setMouse(e: any) {
      this.mouse = e;
    },
  },
});
