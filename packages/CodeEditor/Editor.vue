<template>
  <div>
    <v-system-bar :style="{position: 'absolute', top: '-25px', left: 0, width: '100%', 'justify-content': 'left'}">
      <v-divider class="mx-4" vertical></v-divider>
      <div @click="save" style="font-weight: bold;" label="file">Save</div>
      <v-divider class="mx-4" vertical></v-divider>
      <div v-show="dirty" @click="revert" style="font-weight: bold;" label="file">Revert</div>
      <v-divider v-show="dirty" class="mx-4" vertical></v-divider>
    </v-system-bar>
    <div>
      <div class="monaco-editor" ref="editor"></div>
    </div>
  </div>
</template>
<script lang="typescript">
import {mapWritableState, mapActions, mapState} from "pinia";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";

import * as monaco from "monaco-editor";
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import vueWorker from "monaco-volar/vue.worker?worker";

window.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'vue') {
      return new vueWorker();
    }
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

export default {
  mounted() {
    const cache = localStorage.getItem(this.storeKey);
    const editor = monaco.editor.create(this.$refs.editor, {
      language: this.language,
      value: cache !== null ? cache : this.selectedNode.template[this.templateType],
      theme: this.preferences.appearance.theme === 'dark' ? 'vs-dark' : 'vs',
    });
    this.dirty = !!cache;
    editor.getModel().onDidChangeContent((event) => {
      this.update();
    });
    // HACK: if editor is attached to "this" it will freeze the system
    this.$refs.editor.pinstance = editor;
    this.resize();
  },
  props: {
    templateType: String,
    language: String,
    width: Number,
  },
  data() {
    return {
      dirty: false,
      editor: null,
    };
  },
  methods: {
    ...mapActions(useGraphStore, ['updateNodeTemplate']),
    resize() {
      for (let x = 0; x < 500; x += 100) {
        setTimeout(() => {
          this.$refs.editor.pinstance.layout();
        }, x);
      }
    },
    update() {
      this.dirty = true;
      localStorage.setItem(this.storeKey, this.$refs.editor.pinstance.getValue());
    },
    revert() {
      this.$refs.editor.pinstance.setValue(this.selectedNode.template[this.templateType]);
      this.dirty = false;
    },
    save() {
      this.dirty = false;
      localStorage.removeItem(this.storeKey);
      this.updateNodeTemplate({
        nodeId: this.selectedNode.id,
        type: this.templateType,
        value: this.$refs.editor.pinstance.getValue(),
      });
    },
  },
  watch: {
    graph() {
      this.$refs.editor.pinstance.value = this.selectedNode.template.vue;
    },
    width() {
      this.resize();
    },
  },
  computed: {
    ...mapState(useGraphStore, ['graph', 'selectedNodes', 'selectedNode']),
    ...mapState(usePreferencesStore, ['preferences']),
    storeKey() {
      return this.selectedNode ? 'pinstance-editor-' + this.templateType + '-' + this.selectedNode.id : '';
    },
  },
};
</script>
<style scoped>
  .monaco-editor {
    margin-top: 25px;
    height: calc(100vh - 155px);
    width: 100%;
  }
</style>
