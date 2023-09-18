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
const _createVNode = self.dependencies.vue.createVNode;
const _openBlock = self.dependencies.vue.openBlock;
const _createTextVNode = self.dependencies.vue.createTextVNode;
const _createElementBlock = self.dependencies.vue.createElementBlock;
const _resolveComponent = self.dependencies.vue.resolveComponent;
const _withCtx = self.dependencies.vue.withCtx;
const _createBlock = self.dependencies.vue.createBlock;
`);

    const script = compiler.compileScript(blocks.descriptor, {
        sourceMap: true,
        id,
    });

    let style = compiler.compileStyle({id, ...blocks.descriptor});

    (self as any).dependencies = {
        'vue': vue,
    } as {[key: string]: any};

    const options = {
        ...(await import(/* @vite-ignore */stringToBase64Url(script.content, 'application/Javascript'))).default,
        template: (await import(/* @vite-ignore */stringToBase64Url(template, 'application/Javascript'))),
        render: (await import(/* @vite-ignore */stringToBase64Url(template, 'application/Javascript'))).render,
        style: await import(/* @vite-ignore */stringToBase64Url(style.code, 'application/Javascript')),
    };

    const compDef = vue.defineComponent(options);

    return {
        component: compDef,
        errors: blocks.errors,
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
