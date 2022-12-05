import { defineStore } from 'pinia';
import type {Graph} from "@plastic-io/plastic-io";
import {newId} from "@plastic-io/graph-editor-vue3-utils";
export const useStore = defineStore('graph-manager', {
  state: () => ({}),
  actions: {
    createGraph(createdBy: string): Graph {
      const id = newId();
      const now = new Date();
      return {
        id,
        version: 0,
        url: id,
        nodes: [],
        properties: {
          name: "",
          description: "",
          exportable: false,
          icon: "mdi-graph",
          createdBy: createdBy,
          createdOn: now,
          lastUpdate: now,
          height: 150,
          width: 300,
        }
      };
    }
  }
});
