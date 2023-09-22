<script lang="ts">
  import { markRaw, h, defineComponent, SetupContext } from "vue";
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
      props.node.properties.outputs.forEach((output) => {
          events['on' + output.name[0].toUpperCase() + output.name.substring(1)] = (val) => {
              props.scheduler.instance.url(props.node.url, val, output.name, props.hostNode);
          };
      });

      return () => {
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
        return h(
          {...props.component},
          importedProps,
        );
      };
    }
  });
</script>
