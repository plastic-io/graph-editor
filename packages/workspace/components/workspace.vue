<script lang="ts">
import { useStore } from '../store';
export default {
  name: 'workspace',
  data: () => {
    return {
      store: {},
    }
  },
  mounted() {
    this.store = useStore();
  },
  methods: {
    addDocument() {
      this.store.addDocument({foo: Date.now()});
    },
  }
}

</script>
<template>
  <div>
    {{store.name}}
    <button @click="addDocument()">Add Document</button>
  </div>
</template>
<style scoped>

</style>