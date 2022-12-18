import { defineStore } from 'pinia';
import type {Graph} from "@plastic-io/plastic-io";
export const useStore = defineStore('node', {
  state: () => ({}),
  actions: {
    replacer(key: any, value: any) {
        if (key === "__contextId") {
            return undefined;
        }
        return value;
    }
  }
});
