<script lang="ts">
import {useStore} from "@plastic-io/graph-editor-vue3-workspace";
export default {
  name: 'error-interstitial',
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