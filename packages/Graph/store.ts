import { defineStore } from 'pinia';
import type Pinia from 'pinia';
import type {Graph, Node} from "@plastic-io/plastic-io";
import {useStore as useGraphManagerStore} from "@plastic-io/graph-editor-vue3-manager";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
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
