import {type Router, useRoute} from "vue-router";
import {h, defineComponent, ref, watch} from "vue";
import Editor from "./Editor.vue";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";

export default (router: Router) => {

  const orchistratorStore = useOrchestratorStore();
  const preferencesStore = usePreferencesStore();
  const graphStore = useGraphStore();
  const editor = defineComponent({
    setup() {
      const route = useRoute();
      const nodeId = route.params.nodeId as string;
      const templateType = route.params.templateType as string;
      let errors = ref([]);
      let value = ref('');
      
      orchistratorStore.setTheme(preferencesStore.preferences!.appearance.theme);
      watch(() => graphStore.graph, newVal => {
        value = graphStore.graph.nodes.find((n: any) => n.id === nodeId).template[templateType]
      });
      watch(() => orchistratorStore.errors, newVal => {
        errors = orchistratorStore.errors;
      });
      return () => h(Editor, {
        ...route.params,
        value,
        errors,
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

  router.addRoute('popout-editor', {
    path: "/popout-editor/:documentId/:nodeId/:templateType/:language",
    name: "popout-editor",
    component: editor,
  });
}
