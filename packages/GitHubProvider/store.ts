import {useStore as useAuthenticationProviderStore} from "@plastic-io/graph-editor-vue3-authentication-provider";
import { defineStore } from 'pinia';
export const useStore = defineStore('github', {
    state: () => ({
      authenticationStore: useAuthenticationProviderStore(),
      repos: {},
    }),
    actions: {
      async getGetHubApiFile(url: string): Promise<any> {
        const data = await fetch(url);
        const dataJson = await data.json();
        return JSON.parse(atob(dataJson.content));
      },
      async getPublicRepository(e: any) {
        const relPath = /^\.\//;
        let repo = e.url.replace('https://github.com/', '');
        let url = `https://api.github.com/repos/${repo}/contents/index.json`;
        if (e.parent.url && relPath.test(e.url)) {
          url = e.url.replace(relPath, e.parent.url + "/")
            .replace(/\/contents\/index.json/, '/contents');
        }
        const responseJson = await this.getGetHubApiFile(url);
        if (responseJson.items) {
          responseJson.url = url;
          this.$patch({
            repos: {
              [e.url]: {
                parent: e.parent,
                toc: responseJson,
                url: e.url,
              }
            }
          });
          responseJson.items.forEach((item: any) => {
            if (item.type === "toc") {
              item.url = url;
              this.getPublicRepository({
                url: item.artifact,
                parent: item,
              });
            }
            if (item.items) {
              item.items.forEach((subItem: any) => {
                if (subItem.type === "publishedNode" || subItem.type === "publishedGraph") {
                  if (url && relPath.test(subItem.artifact)) {
                      subItem.url = subItem.artifact.replace(relPath, url.substring(0, url.lastIndexOf("/")) + "/");
                  }
                }
              });
            }
          });
        }
      },
    },
});
