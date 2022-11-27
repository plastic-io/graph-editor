<script lang="ts">
import {useStore} from "@plastic-io/workspace";
export default {
  name: 'connector-info',
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