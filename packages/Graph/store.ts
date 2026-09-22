import { defineStore } from 'pinia';
import type {Graph} from "@plastic-io/plastic-io";
import connectors from './connectors';
import movement from './movement';
import clipboard from './clipboard';
import viewport from './viewport';
import mutation from './mutation';
import rewind from './rewind';
import versions from './versions';
import proposals from './proposals';
import live from './live';
import presence from './presence';
import text from './text';
import info from './info';
import state from './state';
import inside from './inside';

export const useStore: any = defineStore('graph', {
  state,
  getters: {
    /**
     * Whether what the canvas is showing may be edited.  Two things put it out
     * of reach and both mean the same to every editing surface: a past state
     * (rewind) and the inside of a call, which belongs to the component's own
     * document (PB-115).
     */
    readOnly(state: any): boolean {
      return !!(state.inRewindMode || state.insideInstance);
    },
  },
  actions: {
    ...connectors,
    ...movement,
    ...clipboard,
    ...viewport,
    ...mutation,
    ...rewind,
    ...versions,
    ...proposals,
    ...live,
    ...presence,
    ...text,
    ...info,
    ...inside,
  },
});

export const useGraphSnapshotStore: any = defineStore('graph-snapshot', {
  state() {
    return {
      graph: null as Graph | null,
    }
  }
});
