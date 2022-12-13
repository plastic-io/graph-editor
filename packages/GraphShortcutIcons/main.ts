import type {App} from "vue";
import type {Router} from "vue-router";
import TopShortcutIcons from "./TopShortcutIcons.vue";
import BottomShortcutIcons from "./BottomShortcutIcons.vue";
import GraphEditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-graph-editor-module";
import {useStore as useGraphOrchestratorStore} from "@plastic-io/graph-editor-vue3-graph-orchestrator";

export default class ShortcutIcons extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('top-shortcut-icons', TopShortcutIcons);
    app.component('bottom-shortcut-icons', BottomShortcutIcons);
    const graphOrchestratorStore =  useGraphOrchestratorStore();
    const topIcons = new Plugin({
      name: 'Top Shortcut Icons',
      component: 'top-shortcut-icons',
      type: 'system-bar-top',
      order: 0,
    });
    const bottomIcons = new Plugin({
      name: 'Bottom Shortcut Icons',
      component: 'bottom-shortcut-icons',
      type: 'system-bar-bottom',
      order: 0,
    });
    graphOrchestratorStore.addPlugin(topIcons);
    graphOrchestratorStore.addPlugin(bottomIcons);
  }
};
