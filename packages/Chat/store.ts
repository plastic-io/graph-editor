import {defineStore} from 'pinia';
import {markRaw} from 'vue';
import {ChatClient} from './client';
export const useChatStore = defineStore('chat', {
  state: () => ({client: null as ChatClient | null}),
  actions: {
    attach(socket: any) {
      if (this.client?.socket === socket) return;
      this.client?.dispose();
      this.client = socket?.onOpen ? markRaw(new ChatClient(socket)) : null;
    },
  },
});
