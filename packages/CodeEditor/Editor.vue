<template>
  <div>
    <div v-show="selectedNodes.length > 0">
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
    <div class="ma-3" v-show="selectedNodes.length === 0">
        <i>No nodes selected</i>
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
    this.init();
  },
  props: {
    templateType: String,
    language: String,
  },
  data() {
    return {
      dirty: false,
      editor: null,
    };
  },
  methods: {
    ...mapActions(useGraphStore, ['updateNodeTemplate']),
    syncErrors() {
      const model = this.$refs.editor.pinstance.getModel();
      monaco.editor.setModelMarkers(model, 'owner', this.errors
        .map((item) => {
        const e = item.error;
        e.loc = e.loc || {start:{column: 0, line: 0}, end:{column: 0, line: 0}};
        return {
            message: e.message,
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: e.loc.start.line,
            startColumn: e.loc.start.column,
            endLineNumber: e.loc.end.line,
            endColumn: e.loc.end.column,
        }
      }));
    },
    init() {
      if (!this.selectedNode) {
        return;
      }
      const editor = monaco.editor.create(this.$refs.editor, {
        language: this.language,
        theme: this.preferences.appearance.theme === 'dark' ? 'vs-dark' : 'vs',
      });
      editor.getModel().onDidChangeContent((event) => {
        this.update();
      });
      // HACK: if editor is attached to "this" it will freeze the system
      this.$refs.editor.pinstance = editor;
      this.resize();
      this.loadFromCache();
      this.syncErrors();
    },
    loadFromCache() {
      if (!(this.$refs.editor && this.$refs.editor.pinstance)) {
        return;
      }
      const cache = localStorage.getItem(this.storeKey);
      this.dirty = !!cache;
      const val = cache !== null ? cache : this.selectedNode.template[this.templateType];
      this.$refs.editor.pinstance.setValue(val);
    },
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
    selectedNode() {
      if (!this.selectedNode) {
        return;
      }
      this.loadFromCache();
    },
    graph() {
      this.$refs.editor.pinstance.value = this.selectedNode.template.vue;
    },
    navWidth() {
      this.resize();
    },
    errors() {
      this.syncErrors();
    },
  },
  computed: {
    ...mapState(useGraphStore, ['graph', 'selectedNodes', 'selectedNode']),
    ...mapState(usePreferencesStore, ['preferences']),
    ...mapState(useOrchestratorStore, {
      "scheduler": "scheduler",
      "nodeErrors": "errors",
      "navWidth": "navWidth",
    }),
    storeKey() {
      return this.selectedNode ? 'pinstance-editor-' + this.templateType + '-' + this.selectedNode.id : '';
    },
    errors() {
      if (!this.selectedNode) {
        return [];
      }
      return this.nodeErrors[this.selectedNode.id] || [];
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
