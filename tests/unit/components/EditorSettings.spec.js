// import Vue from "vue";
import { mount, createLocalVue } from "@vue/test-utils";
import EditorSettings from "../../../src/components/EditorSettings.vue";
import Vuetify from "vuetify";
import Vue from "vue";
import Vuex from "vuex";
import acidJson from "../../stubs/acid.json";
const localVue = createLocalVue();
let store;
let storeConfig;
let wrapper;
let acid;
localVue.use(Vuex);
Vue.use(Vuetify);
describe("EditorSettings.vue", () => {
    beforeEach(() => {
        document.body.setAttribute("data-app", true);
        acid = JSON.parse(JSON.stringify(acidJson));
        storeConfig = {
            state: {
                domainTags: [],
                translating: {},
                keys: {},
                graph: acid,
                locked: false,
                identity: {
                    provider: "local",
                },
                preferences: {
                    appearance: {
                        showGrid: false,
                    },
                },
                mouse: {
                    lmb: false,
                    rmb: false,
                    mmb: false,
                    x: 0,
                    y: 0
                },
                view: {
                    x: 0,
                    y: 0,
                    k: 1,
                },
                selectedVector: null,
            },
            actions: {
                updateEditorSettings: jest.fn(),
                publishGraph: jest.fn(),
                save: jest.fn(),
            },
            mutations: {
                selectVector: jest.fn(),
            },
            getters: {
                getField: () => {
                    return jest.fn();
                },
            },
        };
        store = new Vuex.Store(storeConfig);
        let vuetify = new Vuetify();
        wrapper = mount(EditorSettings, {
            localVue,
            store,
            vuetify,
            propsData: {},
        });
    });
    describe("EditorSettings Methods", () => {
        it("Should render a properties form bound using vuex-map-fields.mapFields/getField", (done) => {
            expect(wrapper.html()).toMatch("Workstation Id");
            done();
        });
    });
});
