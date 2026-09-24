import { describe, it, expect, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import * as vue from "vue";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import importVue from "../importVue";

/**
 * Every node in the flow-control vocabulary mounts, and shows what it is.
 *
 * A node without a presentation is not a node anybody can use: there is
 * nothing to read, and — as the owner put it — nothing to grab hold of to move
 * it.  So this compiles each published template the way the editor does and
 * mounts it, which catches two things eyeballing the canvas does not:
 *
 *   - a template that fails to mount at all.  A dynamic `:class` compiles to
 *     `_normalizeClass`, which the helper list did not carry, and the node
 *     failed with "_normalizeClass is not defined" — visible only as an empty
 *     box on the canvas, and only if you were looking at that node.
 *   - a template that mounts and draws nothing, which looks identical to a
 *     node that is not there.
 */

const root = resolve(__dirname, "../../../vocabulary");
const names = readdirSync(root).filter((f) => f.endsWith(".json") && f !== "index.json");
const definitions = names.map((file) => ({ id: file.replace(/\.json$/, ""), ...JSON.parse(readFileSync(resolve(root, file), "utf8")) }));

beforeAll(() => {
  // the compiled template reaches for its helpers here, as it does in the editor
  (globalThis as any).self = (globalThis as any).self || globalThis;
  (globalThis as any).self.dependencies = { vue };
});

const vuetify = createVuetify({ components, directives });
/** A node as the canvas hands it to its view: its data, and nothing else. */
const nodeFor = (definition: any) => ({
  id: definition.id,
  properties: { name: definition.name, outputs: (definition.outputs || []).map((name: string) => ({ name })) },
  data: null,
});

describe("the vocabulary has a face", () => {
  it("has a definition for every node, with a template", () => {
    expect(definitions.length).toBeGreaterThanOrEqual(18);
    definitions.forEach((definition) => {
      expect(definition.vue, `${definition.id} has no presentation`).toBeTruthy();
      expect(definition.set, `${definition.id} has no set script`).toBeTruthy();
    });
  });

  definitions.forEach((definition) => {
    it(`${definition.id} compiles, mounts, and says what it is`, async () => {
      const compiled: any = await importVue(definition.vue, definition.id);
      expect(compiled.errors, `${definition.id}: ${JSON.stringify(compiled.errors)}`).toEqual([]);
      expect(compiled.component).toBeTruthy();

      const wrapper = mount(compiled.component, {
        global: { plugins: [vuetify] },
        props: { node: nodeFor(definition), state: {} },
      });
      await vue.nextTick();
      const text = wrapper.text().replace(/\s+/g, " ").trim();
      // it drew something, and what it drew names the node, so a person can
      // tell one from another on a canvas full of them
      expect(text.length, `${definition.id} drew nothing`).toBeGreaterThan(0);
      expect(text.toLowerCase(), `${definition.id} does not name itself`).toContain(definition.name.toLowerCase());
      // and something to take hold of: a box with a size, not a bare label
      expect(wrapper.find(".v-card").exists(), `${definition.id} has no card to grab`).toBe(true);
      wrapper.unmount();
    });
  });

  it("a node whose data has not been set yet still mounts", async () => {
    // the first render happens before any run, so `node.data` is null; a
    // template that assumes otherwise dies on a graph nobody has run
    for (const definition of definitions) {
      const compiled: any = await importVue(definition.vue, definition.id);
      const wrapper = mount(compiled.component, { global: { plugins: [vuetify] }, props: { node: nodeFor(definition), state: {} } });
      await vue.nextTick();
      expect(wrapper.text().length, `${definition.id} with no data`).toBeGreaterThan(0);
      wrapper.unmount();
    }
  });
});
