<template>
  <component
    :is="isPopout ? 'v-app' : 'div'"
    ref="dialog"
    class="no-graph-target"
    :style="editorContainerStyle"
    @mousedown.stop="mousedown($event)">
    <div style="position: relative;">
      <div
        class="monaco-editor"
        ref="editor"
        :style="editorStyle">
        <v-system-bar
          class="no-select"
          :style="{position: 'absolute', top: '-24px', left: 0, width: '100%', 'justify-content': 'left'}">
          <v-icon v-if="!isPopout" size="small" icon="mdi-close" @click="$emit('close')"/>
          <v-divider class="mx-3" vertical></v-divider>
          <div style="margin-left: auto;"></div>
          <v-divider class="mx-3" vertical></v-divider>
          <v-icon v-show="!autosave" icon="mdi-content-save" @click="save" title="Save"/>
          <v-icon :color="autosave ? 'green' : ''" icon="mdi-auto-upload" title="Autosave" @click="autosave = !autosave"/>
          <v-divider class="mx-3" vertical></v-divider>
          <v-icon
            icon="mdi-help-circle-outline"
            @click="openHelp"
            :style="{
              opacity: helpLink ? '.6': '0'
          }"/>
          <v-divider class="mx-3" vertical></v-divider>
          <v-icon
            v-if="!isPopout" icon="mdi-open-in-new" @click="popout"/>
          
        </v-system-bar>
      </div>
    </div>
  </component>
</template>
<script lang="typescript">
import {mapWritableState, mapActions, mapState} from "pinia";
import {newId} from "@plastic-io/graph-editor-vue3-utils";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import {editorLibSrc} from "@plastic-io/graph-editor-vue3-help-overlay";
import {useRoute} from 'vue-router';
import Scheduler from "@plastic-io/plastic-io"

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
    const libUri = 'global.d.ts';
    const diagParams = {
        noSemanticValidation: false,
        noSyntaxValidation: false,
        diagnosticCodesToIgnore: [
          /* top-level return */ 1108,
          /* top-level async */ 1375,
          /* replace require with import */ 80005,
        ]
    };
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagParams);
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagParams);
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true
    });
    console.log('editorLibSrc');
    monaco.languages.typescript.typescriptDefaults.addExtraLib(editorLibSrc, libUri);
    // monaco.editor.createModel(editorLibSrc, 'typescript', monaco.Uri.parse(libUri));
    await this.initEditor();
    if (this.isPopout) {
      window.addEventListener('resize', this.debounceLayout);
      return;
    }
    window.addEventListener('close', this.closePopoutWindow);
    document.addEventListener('mouseup', this.mouseup);
    document.addEventListener('mousemove', this.mousemove);
  },
  beforeDestroy() {
    if (this.isPopout) {
      window.removeEventListener('resize', this.debounceLayout);
      return;
    }
    window.removeEventListener('close', this.closePopoutWindow);
    document.removeEventListener('mouseup', this.mouseup);
    document.removeEventListener('mousemove', this.mousemove);
  },
  props: {
    templateType: String,
    language: String,
    nodeId: String,
    value: String,
    graphId: String,
    helpLink: String,
    errors: Array,
  },
  data() {
    return {
      id: newId(),
      cursorLocation: null,
      updatingValue: false,
      editorHasFocus: false,
      autosave: true,
      messageIds: [],
      externalErrors: [],
      loaded: false,
      win: null,
      timer: 0,
      broadcastChannel: null,
      debounceTimer: null,
      broadcastUpdateTimer: null,
      saveDebounceTimer: null,
      dirty: false,
      emptyMessageTimer: null,
      editor: null,
      cursor: undefined,
      localValue: '',
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
    async initEditor() {
      this.broadcastChannel = new BroadcastChannel(this.storeKey);
      this.broadcastChannel.onmessage = (e) => {
        const message = e.data;
        if (message.senderId === this.id) {
          return;
        }
        if (this.messageIds.indexOf(message.id) !== -1) {
          return;
        }
        clearTimeout(this.emptyMessageTimer);
        this.emptyMessageTimer = setTimeout(() => {
          // let's make sure we don't cause a memory leak
          // we'll clear out the deconflicting event id array
          //  every n seconds of inactivity
          this.messageIds = [];
        }, 15000);

        this.messageIds.push(message.id);
        if (message.type === 'errors') {
          this.externalErrors = message.value;
          this.syncErrors();
        }
        // update is when one of the other editors of the same key has changed
        // or value is when the external node has chnaged
        // either way we update the current value if it does not match
        if (message.type === 'update' || message.type === 'value') {
          if (this.editorHasFocus || !this.$refs.editor || !this.$refs.editor.pinstance) {
            return;
          }
          const existingValue = this.getValue();
          if (message.value !== existingValue) {
            this.setValue(message.value);
          }
        }
        if (message.type === 'dirty') {
          this.$emit('dirty', message.value);
        }
      };
      const editor = monaco.editor.create(this.$refs.editor, {
        language: this.language,
        theme: this.preferences.appearance.theme === 'dark' ? 'vs-dark' : 'vs',
      });
      editor.onDidFocusEditorText((event) => {
        this.editorHasFocus = true;
      });
      editor.onDidBlurEditorText((event) => {
        this.editorHasFocus = false;
      });
      editor.getModel().onDidChangeContent((event) => {
        this.update();
        if (this.updatingValue && this.cursorLocation) {
          this.$refs.editor.pinstance.setPosition(this.cursorLocation);
        }
      });
      editor.onDidChangeCursorPosition(e => {
        if (!this.updatingValue) {
          this.cursorLocation = this.$refs.editor.pinstance.getPosition();
        }
      });
      // HACK: if editor is attached to "this" it will freeze the system
      this.$refs.editor.pinstance = editor;
      const getSize = (l, defaultSize) => {
        return localStorage.getItem(this.storeKey + '-size-' + l) || defaultSize;
      };

      this.top = getSize('top', 0);
      this.left = getSize('left', 0);
      this.width = getSize('width', 700);
      this.height = getSize('height', 500);

      this.resize();
      this.loadFromCache();
      this.syncErrors();

    },
    openHelp() {
      if (!this.helpLink) {return;}
      window.open(this.helpLink, 'helpLink');
    },
    closePopoutWindow() {
      if (this.win) {
        this.win.close();
      }
    },
    sendBroadcast({type, value}) {
      const id = newId();
      this.messageIds.push(id);
      this.broadcastChannel.postMessage({
        id,
        senderId: this.id,
        type,
        value,
      });
    },
    popout() {
      this.$emit('close');
      const url = `${this.pathPrefix}popout-editor/${this.graphId}/${this.nodeId}/${this.templateType}/${this.language}`;
      const host = /^localhost:?/.test(window.location.host) ? (window.location.protocol
              + '//' + window.location.host) : '/';
      this.win = window.open(host + url, this.storeKey,
        `popup,width=${this.width},height=${this.width},top=${this.top},left=${this.left}`);
      for (let x = 500; x < 3000; x += 500) {
        setTimeout(() => {
          this.broadcastErrors();
        }, x);
      }
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
      if (!this.$refs.editor || !this.$refs.editor.pinstance) {
        return;
      }
      const model = this.$refs.editor.pinstance.getModel();
      monaco.editor.setModelMarkers(model, 'owner', [...this.errors, ...this.externalErrors]
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
    loadFromCache() {
      if (!(this.$refs.editor && this.$refs.editor.pinstance)) {
        return;
      }
      this.localValue = this.value;
      const cache = localStorage.getItem(this.storeKey);
      const val = cache !== null ? cache : this.localValue;
      if (cache && cache !== this.localValue) {
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
      if (this.editorHasFocus || !this.$refs.editor || !this.$refs.editor.pinstance) {
        return;
      }
      this.updatingValue = true;
      this.$refs.editor.pinstance.setValue(val);
      this.updatingValue = false;
    },
    getValue() {
      return this.$refs.editor.pinstance.getValue();
    },
    update() {
      const newValue = this.getValue();
      this.dirty = newValue !== this.localValue;
      localStorage.setItem(this.storeKey, this.getValue());

      if (!this.dirty) { return; }

      clearTimeout(this.broadcastUpdateTimer);
      this.broadcastUpdateTimer = setTimeout(() => {
        this.sendBroadcast({
          type: 'update',
          value: newValue,
        });
      }, 1500)

      if (this.autosave) {
        clearTimeout(this.saveDebounceTimer);
        this.saveDebounceTimer = setTimeout(() => {
          this.save();
        }, 500);
      }
    },
    revert() {
      this.setValue(this.localValue);
      this.dirty = false;
    },
    save() {
      this.dirty = false;
      localStorage.removeItem(this.storeKey);
      this.$emit('save', this.getValue());
    },
    broadcastErrors() {
      this.sendBroadcast({
        type: 'errors',
        value: this.errors.map((err) => {
          return {
            ...err,
            error: {message: err.error.message},
          }
        }),
      });
    },
  },
  watch: {
    dirty() {
      this.sendBroadcast({
        type: 'dirty',
        value: this.dirty,
      });
      this.$emit('dirty', this.dirty);
    },
    nodeId() {
      this.loadFromCache();
    },
    value() {
      this.localValue = this.value;
      if (this.$refs.editor) {
        this.setValue(this.localValue);
      }
    },
    navWidth() {
      this.resize();
    },
    errors() {
      this.broadcastErrors();
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
      "pathPrefix": "pathPrefix",
    }),
    isPopout() {
      return /popout-editor/.test(window.location.pathname);
    },
    editorContainerStyle() {
      return {
        maxWidth: this.isPopout ? '100vw !important' : undefined,
        width: this.isPopout ? '100vw !important' : undefined,
        zIndex: '3',
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
