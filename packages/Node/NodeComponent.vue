<script lang="ts">
  import { ref, markRaw, h, defineComponent, SetupContext, watch, onErrorCaptured, emit } from "vue";
  import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
  import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
  import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
  import {useStore as useGraphStore, useGraphSnapshotStore} from "@plastic-io/graph-editor-vue3-graph";
  import {toJSON} from 'flatted';
  export default defineComponent({
    name: 'node-component',
    props: {
      component: Object,
      graph: Object,
      node: Object,
      presentation: Boolean,
      scheduler: Object,
      state: Object,
      nodeProps: Object,
    },
    setup(props: any, { slots, emit }: SetupContext) {
      const graphStore = useGraphStore();
      const events = {};
      // bind outputs (events)
      props.node.properties.outputs.forEach((output) => {
        events['on' + output.name[0].toUpperCase() + output.name.substring(1)] = (val) => {
          try {
            val = JSON.parse(JSON.stringify(val));
          } catch (_) {}
          props.scheduler.instance.url(props.node.url, val, output.name, props.hostNode);
        };
      });
      const importedProps = {
        stores: {
          orchestratorStore: useOrchestratorStore(),
          preferencesStore: usePreferencesStore(),
          inputStore: useInputStore(),
          graphStore: useGraphStore(),
        },
        async transact(descripton: string, callback: any) {
          const node = graphStore.graphSnapshot.nodes.find(n => n.id === props.node.id);
          await callback(node);
          await graphStore.updateGraphFromSnapshot(descripton);
        },
        graph: graphStore.graphSnapshot,
        node: props.node,
        scheduler: props.scheduler,
        presentation: props.presentation,
        state: props.state,
        ...props.nodeProps,
        ...events,
        onData(e: any) {
          emit('data', e);
        },
        onImpulse(value) {
          props.scheduler.instance.url(props.node.url, value, 'impulse', props.hostNode);
        },
        onImpulseServer(value) {
          console.log('impluse server');
          useOrchestratorStore().dataProviders.graph.send({
              action: 'executeGraph',
              graphUrl: graphStore.graphSnapshot.url,
              nodeUrl: props.node.url,
              value: value,
              field: 'impulse',
          });
        }
      };

      const comp = h(
        {...props.component},
        importedProps,
      );

      const mountError = (error) => {
        emit('mountError', new Error('Error mounting node component. ' + error));
        return false;
      }

      // Capture errors from child components
      onErrorCaptured(mountError);

      return () => {
        return comp;
      };
    }
  });
</script>
