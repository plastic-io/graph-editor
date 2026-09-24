import * as compiler from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as ts from 'typescript';

export default async function (sfc: string, id: string) {
    const SCRIPT_KEY = id + '-script';
    const TEMPLATE_KEY = id + '-template';
    const STYLE_KEY = id + '-style';
    const errors = [];
    /**
     * Nothing to draw is not a failure.  A node whose `template.vue` is empty
     * has no single-file component to compile, and the SFC parser rightly says
     * so — "At least one <template> or <script> is required" — which the card
     * then showed instead of the node.  The question was never asked of it.
     */
    const empty = { styles: [] as any[], component: { render: () => null }, errors: [] as any[] };
    if (!sfc || !String(sfc).trim()) {
        return empty;
    }
    const blocks = await compiler.parse(sfc, {
        filename: id + '.vue',
        sourceMap: true,
    });
    const descriptor: any = (blocks as any).descriptor;
    /**
     * A node that draws nothing draws nothing.  An empty `template.vue`, or one
     * with only a script, has no <template> block, and reading its content threw
     * a TypeError that the caller turned into an error component — so every node
     * without a template said "Cannot read properties of null" on the canvas.
     */
    const hasTemplate = !!(descriptor && descriptor.template);
    const hasScript = !!(descriptor && (descriptor.script || descriptor.scriptSetup));
    if (!hasTemplate && !hasScript) {
        // whitespace, or a comment, and the same answer: it draws nothing
        return empty;
    }
    const template = !hasTemplate ? "" : compiler.compileTemplate({
        id,
        ...blocks.descriptor,
        ssr: false,
        source: descriptor.template.content,
    }).code
        .replace(/import\s*\{([^}]*)\}\s*from\s*"vue"/g, (whole: string, names: string) =>
            /**
             * Hand the compiled template the helpers it actually asked for.
             *
             * This used to be a hand-written list of every helper anyone had
             * needed so far, which is a list that rots: a node with a dynamic
             * `:class` compiles to `_normalizeClass`, which was not on it, and
             * the node failed to mount with "_normalizeClass is not defined".
             * The compiler already says what it imported and what it called it;
             * reading that is both shorter and never out of date.
             */
            names.split(",").map((entry: string) => {
                const [exported, local] = entry.split(/\s+as\s+/).map((part: string) => part.trim());
                const alias = local || exported;
                return alias ? `const ${alias} = self.dependencies.vue.${exported};` : "";
            }).filter(Boolean).join("\n"));

    const script = hasScript ? compiler.compileScript(blocks.descriptor, {
        sourceMap: true,
        id,
    }) : null;

    let styles = blocks.descriptor.styles.map((style: any) => {
        const s = compiler.compileStyle({id, source: style.content} as any);
        errors.push(...s.errors);
        return s.code;
    });

    (self as any).dependencies = {
        'vue': vue,
    } as {[key: string]: any};
    const options = {
        ...(script ? (await import(/* @vite-ignore */stringToBase64Url(script.content, 'application/Javascript'))).default : {}),
        ...(hasTemplate ? {
            template: (await import(/* @vite-ignore */stringToBase64Url(template, 'application/Javascript'))),
            render: (await import(/* @vite-ignore */stringToBase64Url(template, 'application/Javascript'))).render,
        } : { render: () => null }),
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
