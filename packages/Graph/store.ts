import { defineStore } from 'pinia';
import type {Graph} from "@plastic-io/plastic-io";
import connectors from './connectors';
import movement from './movement';
import clipboard from './clipboard';
import viewport from './viewport';
import mutation from './mutation';
import rewind from './rewind';
import versions from './versions';
import live from './live';
import presence from './presence';
import text from './text';
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
    ...rewind,
    ...versions,
    ...live,
    ...presence,
    ...text,
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
