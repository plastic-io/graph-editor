import { defineStore } from 'pinia';
import type {Graph} from "@plastic-io/plastic-io";
import connectors from './connectors';
import movement from './movement';
import clipboard from './clipboard';
import viewport from './viewport';
import mutation from './mutation';
import info from './info';
import state from './state';

export const useStore: any = defineStore('graph', {
  state,
  actions: {
    ...connectors,
    ...movement,
    ...clipboard,
    ...viewport,
    ...mutation,
    ...info,
  },
});

export const useGraphSnapshotStore: any = defineStore('graph-snapshot', {
  state() {
    return {
      graph: null as Graph | null,
    }
  }
});
