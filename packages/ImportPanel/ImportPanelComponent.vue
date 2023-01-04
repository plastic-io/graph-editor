<template>
  <div>
    <v-list dense help-topic="importComponentList"
    style="overflow-y: auto; height: calc(100vh - 305px);margin-right: 3px;margin-bottom: -5px;">
      <v-list-item v-for="component in componentList">
        <span draggable="true" style="cursor: copy;" @dragstart="dragStart($event, component.name)">
            <v-icon icon="mdi-vuejs"/>
        </span>
        {{component.name}}
      </v-list-item>
    </v-list>
  </div>
</template>
<script lang="typescript">
  export default {
    name: 'import-panel-components',
    computed: {
      componentList() {
        return self.plastic.app._instance.appContext.components;
      }
    },
    methods: {
      dragStart(e, component) {
          // put a package together that will blow the socks off of the graph component
          const pkg = {
            component,
            type: 'component',
          };
          e.dataTransfer.setData("application/json+plastic-io", JSON.stringify(pkg));
          e.dataTransfer.dropEffect = "link";
      },
    }
  }
</script>