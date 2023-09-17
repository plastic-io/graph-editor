<template>
  <component
    :is="isPopout ? 'v-app' : 'div'"
    ref="dialog"
    class="no-graph-target"
    :style="editorContainerStyle"
    @mousedown.stop="mousedown($event)">
    <div>
      <div
        class="monaco-editor"
        ref="editor"
        :style="editorStyle">
        <v-system-bar
          class="no-select"
          :style="{position: 'absolute', top: '-24px', left: 0, width: '100%', 'justify-content': 'left'}">
          <v-divider class="mx-4" vertical></v-divider>
          <v-icon icon="mdi-content-save" @click="save"/>
          <v-divider class="mx-4" vertical></v-divider>
          <v-icon icon="mdi-file-undo" v-if="dirty" @click="revert"/>
          <v-divider v-show="dirty" class="mx-4" vertical></v-divider>
          <v-icon v-if="!isPopout" icon="mdi-open-in-new" @click="popout" style="margin-left: auto; display: inline-block;"/>
          <v-icon v-if="!isPopout" icon="mdi-close" @click="$emit('close')" style="display: inline-block;"/>
        </v-system-bar>
      </div>
    </div>
  </component>
</template>
<script lang="typescript">
import {mapWritableState, mapActions, mapState} from "pinia";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import {useRoute} from 'vue-router';

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
  async mounted() {
    await this.initEditor();
    if (this.isPopout) {
      window.addEventListener('resize', this.debounceLayout);
      return;
    }
    document.addEventListener('mouseup', this.mouseup);
    document.addEventListener('mousemove', this.mousemove);
  },
  beforeDestroy() {
    if (this.isPopout) {
      window.removeEventListener('resize', this.debounceLayout);
      return;
    }
    document.removeEventListener('mouseup', this.mouseup);
    document.removeEventListener('mousemove', this.mousemove);
  },
  props: {
    templateType: String,
    language: String,
    nodeId: String,
    value: String,
    graphUrl: String,
    errors: Array,
  },
  data() {
    return {
      loaded: false,
      win: null,
      timer: 0,
      debounceTimer: null,
      dirty: false,
      editor: null,
      cursor: undefined,
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      resizeing: false,
      startResize: {
        top: 0,
        left: 0,
        height: 0,
        width: 0,
      }
    };
  },
  methods: {
    popout() {
      this.$emit('close');
      const url = `/popout-editor/${this.graphUrl}/${this.nodeId}/${this.templateType}/${this.language}`;
      window.open(url, this.storeKey,
        `popup,width=${this.width},height=${this.width},top=${this.top},left=${this.left}`);
    },
    mousemove(e) {
      if (!this.$refs.dialog || this.isPopout) {
        return;
      }
      const rect = this.$refs.dialog.getBoundingClientRect();
      const edgeSize = 5; // pixel range within which to detect edge

      // Cursor position relative to dialog
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (!this.resizeing) {
        if (x <= edgeSize && y <= edgeSize) {
          this.cursor = 'nw-resize';
        } else if (x >= rect.width - edgeSize && y <= edgeSize) {
          this.cursor = 'ne-resize';
        } else if (x <= edgeSize && y >= rect.height - edgeSize) {
          this.cursor = 'sw-resize';
        } else if (x >= rect.width - edgeSize && y >= rect.height - edgeSize) {
          this.cursor = 'se-resize';
        } else if (x <= edgeSize) {
          this.cursor = 'w-resize';
        } else if (x >= rect.width - edgeSize) {
          this.cursor = 'e-resize';
        } else if (y <= edgeSize) {
          this.cursor = 'n-resize';
        } else if (y >= rect.height - edgeSize) {
          this.cursor = 's-resize';
        } else if (y > 0 && y < 35) {
          this.cursor = 'move';
        } else {
          this.cursor = 'auto';
        }
      } else {
        const dx = (e.screenX - this.startResize.screenX) / this.view.k;
        const dy = (e.screenY - this.startResize.screenY) / this.view.k;
        switch (this.cursor) {
          case 'nw-resize':
            this.width = this.startResize.width - dx;
            this.height = this.startResize.height - dy;
            this.left = this.startResize.left + dx;
            this.top = this.startResize.top + dy;
            break;
          case 'ne-resize':
            this.width = this.startResize.width + dx;
            this.height = this.startResize.height - dy;
            this.top = this.startResize.top + dy;
            break;
          case 'sw-resize':
            this.width = this.startResize.width - dx;
            this.height = this.startResize.height + dy;
            this.left = this.startResize.left + dx;
            break;
          case 'se-resize':
            this.width = this.startResize.width + dx;
            this.height = this.startResize.height + dy;
            break;
          case 'w-resize':
            this.width = this.startResize.width - dx;
            this.left = this.startResize.left + dx;
            break;
          case 'e-resize':
            this.width = this.startResize.width + dx;
            break;
          case 'n-resize':
            this.height = this.startResize.height - dy;
            this.top = this.startResize.top + dy;
            break;
          case 's-resize':
            this.height = this.startResize.height + dy;
            break;
          case 'move':
            this.left = this.startResize.left + dx;
            this.top = this.startResize.top + dy;
            break;
          default:
            break;
        }
        this.debounceLayout();
      }
    },
    mouseup() {
      if (this.isPopout) {
        return;
      }
      this.resizeing = false;
    },
    mousedown(e) {
      if (this.isPopout) {
        return;
      }
      const rect = this.$refs.dialog.getBoundingClientRect();
      this.startResize = {
        screenX: e.screenX,
        screenY: e.screenY,
        top: this.top,
        left: this.left,
        height: rect.height,
        width: rect.width,
      }
      this.resizeing = true;
      this.timer = Date.now();
    },
    debounceLayout() {
      const layout = () => {
        this.timer = Date.now();
        if (this.$refs.editor && this.$refs.editor.pinstance) {
          this.$refs.editor.pinstance.layout(); // Adjust Monaco editor layout.
        }
      };
      if (Date.now() - this.timer >  500) {
        layout();
      }
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(layout, 150);
    },
    syncErrors() {
      if (!this.graph || !this.$refs.editor.pinstance) {
        return;
      }
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
    async initEditor() {
      const editor = monaco.editor.create(this.$refs.editor, {
        language: this.language,
        theme: this.preferences.appearance.theme === 'dark' ? 'vs-dark' : 'vs',
      });
      editor.getModel().onDidChangeContent((event) => {
        this.update();
      });
      // HACK: if editor is attached to "this" it will freeze the system
      this.$refs.editor.pinstance = editor;
      const getSize = (l, defaultSize) => {
        return localStorage.getItem(this.storeKey + '-size-' + l) || defaultSize;
      };

      this.top = getSize('top', 0);
      this.left = getSize('left', 0);
      this.width = getSize('width', 500);
      this.height = getSize('height', 500);

      this.resize();
      this.loadFromCache();
      this.syncErrors();

    },
    loadFromCache() {
      if (!(this.$refs.editor && this.$refs.editor.pinstance)) {
        return;
      }
      const cache = localStorage.getItem(this.storeKey);
      const val = cache !== null ? cache : this.value;
      if (cache && cache !== this.value) {
        this.dirty = true;
      }
      this.setValue(val);
      this.update();
    },
    resize() {
      for (let x = 0; x < 500; x += 100) {
        setTimeout(() => {
          if (!this.$refs.editor || !this.$refs.editor.pinstance) { return; }
          this.$refs.editor.pinstance.layout();
        }, x);
      }
    },
    setValue(val) {
      this.$refs.editor.pinstance.setValue(val);
    },
    getValue() {
      return this.$refs.editor.pinstance.getValue();
    },
    update() {
      const newValue = this.getValue();
      this.dirty = newValue !== this.value;
      localStorage.setItem(this.storeKey, this.getValue());
    },
    revert() {
      this.setValue(this.value);
      this.dirty = false;
    },
    save() {
      this.dirty = false;
      localStorage.removeItem(this.storeKey);
      this.$emit('save', this.getValue());
    },
  },
  watch: {
    dirty() {
      this.$emit('dirty', this.dirty);
    },
    nodeId() {
      this.loadFromCache();
    },
    value() {
      if (this.$refs.editor) {
        this.$refs.editor.pinstance.value = this.value;
      }
    },
    navWidth() {
      this.resize();
    },
    errors() {
      if (this.$refs.editor) {
        this.syncErrors();
      }
    },
  },
  computed: {
    ...mapState(useGraphStore, ['view']),
    ...mapState(usePreferencesStore, ['preferences']),
    ...mapState(useOrchestratorStore, {
      "scheduler": "scheduler",
      "nodeErrors": "errors",
      "navWidth": "navWidth",
    }),
    isPopout() {
      return /popout-editor/.test(window.location.pathname);
    },
    editorContainerStyle() {
      return {
        maxWidth: this.isPopout ? '100vw !important' : undefined,
        width: this.isPopout ? '100vw !important' : undefined,
        zIndex: '2',
        position: 'absolute',
        background: this.cursor !== 'auto' ?
          'var(--color-border)' : 'var(--color-border-hover)',
        cursor: this.cursor,
        width: this.isPopout ? '100vw' : (this.width + "px"),
        height: this.isPopout ? '100vh' : (this.height + "px"),
        top: this.isPopout ? '0' : (this.top + "px"),
        left: this.isPopout ? '0' : (this.left + "px"),
        borderRadius: '5px',
      };
    },
    editorStyle() {
      return {
        maxWidth: this.isPopout ? '100vw' : undefined,
        width: this.isPopout ? '100vw' : undefined,
        top: this.isPopout ? "24px" : "30px",
        left: this.isPopout ? "0" : "5px",
        width: this.isPopout ? '100vw' : ((this.width - 10) + "px"),
        height: this.isPopout ? '100vh' : ((this.height - 35) + "px"),
      };
    },
    storeKey() {
      return 'pinstance-editor-' + this.templateType + '-' + this.nodeId;
    },
  },
};
</script>
<style scoped>
  .monaco-editor {}
</style>
