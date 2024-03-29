import createVueComponent from "./importVue";
import { defineComponent, h } from 'vue';

export default async function compileTemplate(hostComp: any, id: string, tmp, clearLoad: boolean) {
    let compSource: {component: any, errors: any[]};
    const createErrorComponent = (errs: any) => {
        return {
            errors: errs,
            component: {
              render() {
                return h('div', errs.join(' '));
              },
            }
        }
    };
    try {
        compSource = await createVueComponent(tmp, id);
    } catch (err: any) {
        compSource = createErrorComponent([err]);
    }
    return compSource;
}
