<script lang="ts">
import {useStore} from "@plastic-io/workspace";
export default {
  name: 'node-edge-connector',
  data: () => {
    return {
      store: {},
    }
  },
  mounted() {
    this.store = useStore();
  },
}

</script>
<template>
  <div>
    foo
    {{store.documents}}
  </div>
</template>
<style scoped>

</style>