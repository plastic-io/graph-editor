import { defineStore } from 'pinia';
export const useStore = defineStore('workspace', {
  state: () => ({
    name: 'workspace',
    documents: [] as any[],
  }),
  actions: {
    addDocument(e: any) {
      this.documents.push(e);
    },
  },
});
