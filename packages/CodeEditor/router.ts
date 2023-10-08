import {type Router, useRoute} from "vue-router";
import {h, defineComponent, ref, watch, Suspense} from "vue";
import Editor from "./Editor.vue";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";

export default (router: Router) => {

  const orchistratorStore = useOrchestratorStore();
  const preferencesStore = usePreferencesStore();
  const graphStore = useGraphStore();

  const editorComponent = defineComponent({
    async setup() {
      const route = useRoute();
      orchistratorStore.setTheme(preferencesStore.preferences!.appearance.theme);
      await orchistratorStore.init(route.params.documentId);
      const nodeId = route.params.nodeId as string;
      const templateType = route.params.templateType as string;

      const getValue = (): string => {
        return graphStore.graph.nodes.find((n: any) => n.id === nodeId).template[templateType];
      };

      
      
      return () => h(Editor, {
        ...route.params,
        value: getValue(),
        errors: [],
        'onSave': (value: string) => {
          graphStore.updateNodeTemplate({
            nodeId,
            type: templateType,
            value,
          });
        },
      });
    }
  });

  const suspenseWrapper = defineComponent({
    setup() {
      return () => h(Suspense, {}, {
        default: h(editorComponent),
      });
    }
  });

  router.addRoute('popout-editor', {
    path: "/popout-editor/:documentId/:nodeId/:templateType/:language",
    name: "popout-editor",
    component: suspenseWrapper,
  });
}
