import * as compiler from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as ts from 'typescript';

export default async function (sfc: string, id: string) {
    const SCRIPT_KEY = id + '-script';
    const TEMPLATE_KEY = id + '-template';
    const STYLE_KEY = id + '-style';
    const errors = [];
    const blocks = await compiler.parse(sfc, {
        filename: id + '.vue',
        sourceMap: true,
    });
    const template = compiler.compileTemplate({
        id,
        ...blocks.descriptor,
        ssr: false,
        source: (blocks as any).descriptor.template.content,
    }).code
        .replace(/import {.*} from "vue"/,
            `const _createElementVNode = self.dependencies.vue.createElementVNode;
const _toHandlers = self.dependencies.vue.toHandlers;
const _mergeProps = self.dependencies.vue.mergeProps;
const _guardReactiveProps = self.dependencies.vue.guardReactiveProps;
const _Fragment = self.dependencies.vue.Fragment;
const _renderList = self.dependencies.vue.renderList;
const _createVNode = self.dependencies.vue.createVNode;
const _openBlock = self.dependencies.vue.openBlock;
const _createTextVNode = self.dependencies.vue.createTextVNode;
const _createElementBlock = self.dependencies.vue.createElementBlock;
const _resolveComponent = self.dependencies.vue.resolveComponent;
const _withCtx = self.dependencies.vue.withCtx;
const _createBlock = self.dependencies.vue.createBlock;
const _withDirectives = self.dependencies.vue.withDirectives;
const _vModelText = self.dependencies.vue.vModelText;
const _toDisplayString = self.dependencies.vue.toDisplayString;
const _normalizeProps = self.dependencies.vue.normalizeProps;
const _resolveDynamicComponent = self.dependencies.vue.resolveDynamicComponent;
const _createCommentVNode = self.dependencies.vue.createCommentVNode;
const _vModelRadio = self.dependencies.vue.vModelRadio;
const _vModelCheckbox = self.dependencies.vue.vModelCheckbox;
const _vModelSelect = self.dependencies.vue.vModelSelect;
const _vModelDynamic = self.dependencies.vue.vModelDynamic;
const _vOnWithModifiers = self.dependencies.vue.onWithModifiers;
const _vOnWithoutModifiers = self.dependencies.vue.onWithoutModifiers;
const _vShow = self.dependencies.vue.vShow;
const _createSlots = self.dependencies.vue.createSlots;
const _createStaticVNode = self.dependencies.vue.createStaticVNode;
const _createRenderer = self.dependencies.vue.createRenderer;
const _h = self.dependencies.vue.h; // alias for createVNode
const _useSlots = self.dependencies.vue.useSlots;
const _useAttrs = self.dependencies.vue.useAttrs;
const _useListeners = self.dependencies.vue.useListeners;
const _provide = self.dependencies.vue.provide;
const _inject = self.dependencies.vue.inject;
const _reactive = self.dependencies.vue.reactive;
const _readonly = self.dependencies.vue.readonly;
const _ref = self.dependencies.vue.ref;
const _computed = self.dependencies.vue.computed;
const _watch = self.dependencies.vue.watch;
const _watchEffect = self.dependencies.vue.watchEffect;
const _nextTick = self.dependencies.vue.nextTick;
const _onMounted = self.dependencies.vue.onMounted;
const _onUpdated = self.dependencies.vue.onUpdated;
const _onUnmounted = self.dependencies.vue.onUnmounted;
const _onActivated = self.dependencies.vue.onActivated;
const _onDeactivated = self.dependencies.vue.onDeactivated;
const _onBeforeMount = self.dependencies.vue.onBeforeMount;
const _onBeforeUpdate = self.dependencies.vue.onBeforeUpdate;
const _onBeforeUnmount = self.dependencies.vue.onBeforeUnmount;
const _onErrorCaptured = self.dependencies.vue.onErrorCaptured;
const _onRenderTracked = self.dependencies.vue.onRenderTracked;
const _onRenderTriggered = self.dependencies.vue.onRenderTriggered;
const _teleport = self.dependencies.vue.teleport;
const _suspense = self.dependencies.vue.suspense;
const _normalizeStyle = self.dependencies.vue.normalizeStyle;
`);

    const script = compiler.compileScript(blocks.descriptor, {
        sourceMap: true,
        id,
    });

    let styles = blocks.descriptor.styles.map((style: any) => {
        const s = compiler.compileStyle({id, source: style.content} as any);
        errors.push(...s.errors);
        return s.code;
    });

    (self as any).dependencies = {
        'vue': vue,
    } as {[key: string]: any};
    const options = {
        ...(await import(/* @vite-ignore */stringToBase64Url(script.content, 'application/Javascript'))).default,
        template: (await import(/* @vite-ignore */stringToBase64Url(template, 'application/Javascript'))),
        render: (await import(/* @vite-ignore */stringToBase64Url(template, 'application/Javascript'))).render,
    };

    const compDef = vue.defineComponent(options);
    errors.push(...blocks.errors);
    return {
        styles,
        component: compDef,
        errors,
    };

}

function stringToBase64Url(input: string, contentType: string) {
  // Convert the input string to a Uint8Array
  const inputBytes = new TextEncoder().encode(input);
  // Convert the Uint8Array to a base64 string
  const base64 = btoa(String.fromCharCode.apply(null, (inputBytes as any)));
  // Create the base64 URL by appending the content type and base64 string
  return `data:${contentType};base64,${base64}`;
}

function compileScript(script: string): string {
    const result = ts.transpileModule(script, {
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            sourceMap: true,
            inlineSourceMap: true,
        }
    });
    return result.outputText;
}
