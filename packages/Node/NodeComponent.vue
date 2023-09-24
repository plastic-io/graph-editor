<script lang="ts">
  import { ref, markRaw, h, defineComponent, SetupContext, watch, onErrorCaptured, emit } from "vue";
  import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
  export default defineComponent({
    name: 'node-component',
    props: {
      component: Object,
      graph: Object,
      node: Object,
      scheduler: Object,
      state: Object,
      nodeProps: Object,
    },
    setup(props: any, { slots, emit }: SetupContext) {

      const events = {};
      // bind outputs (events)
      props.node.properties.outputs.forEach((output) => {
        events['on' + output.name[0].toUpperCase() + output.name.substring(1)] = (val) => {
          props.scheduler.instance.url(props.node.url, val, output.name, props.hostNode);
        };
      });

      const importedProps = {
        graph: props.graph,
        node: props.node,
        scheduler: props.scheduler,
        state: props.state,
        ...props.nodeProps,
        ...events,
        onDataChange(e: any) {
          emit('dataChange', e);
        },
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
