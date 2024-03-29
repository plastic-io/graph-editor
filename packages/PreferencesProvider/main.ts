import { defineStore } from 'pinia';
import getRandomName from "@plastic-io/graph-editor-names"
import {newId} from "@plastic-io/graph-editor-vue3-utils";
import {Appearance} from "@plastic-io/graph-editor-vue3-appearance"
const defaultNewSetTemplate = `if (edges.hasOwnProperty(field)) {
   edges[field] = value;
} else {
    state.nodes[node.id][field] = value;
}`;
const defaultNewVueTemplate = `<template>
    <div>
        <v-btn @click="$emit('output-name', 'value-to-send');">
            {{node.properties.name}}
        </v-btn>
    </div>
</template>
<script>
export default {
    props: {
        node: Object,
        state: Object,
    }
}
</script>
`;
const defaultNewGraphTemplate = `<template>
    <div>
        <node
            v-for="node in graph.nodes"
            :key="node.id + node.version"
            :node="node"
            :hostNode="hostNode"
            :graph="graph"
            :presentation="true"
        />
    </div>
</template>
<script>
export default {
    name: 'presentation-graph',
    props: {
        hostNode: Object,
        graph: Object,
        state: Object,
    }
}
</script>`;
export const useStore = defineStore('UserPreferences', {
  state: () => ({
    remotePreferences: null as any,
    preferences: null as null | UserPreferences,
    originalPreferences: null as null | UserPreferences,
  }),
});
export class UserPreferences {
    userName: string;
    email: string;
    userId: string;
    avatar: string;
    workstationId: string;
    newNodeHelp: boolean;
    showLabels: boolean;
    textLabels: boolean;
    showConnectorActivity: boolean;
    debug: boolean;
    showMap: boolean;
    useLocalStorage: boolean;
    showRemoteMouseMovements: boolean;
    maxConnectorActivity: number;
    newNodeOffset: {x: number, y: number, z: number};
    defaultNewGraphTemplate: string;
    defaultNewSetTemplate: string;
    defaultNewVueTemplate: string;
    registries: string;
    componentScripts: string;
    snapToGrid: boolean;
    remoteConfiguration: string;
    gridSize: number;
    graphWSSServer: string;
    graphHTTPServer: string;
    appearance: Appearance;
    uiSize: Record<string, number>;
    constructor() {
        this.userName = getRandomName();
        this.email = "";
        this.userId = '0';
        this.avatar = "https://adorable-avatars.broken.services/" + this.userName.replace(/ /g, "") + ".png";
        this.workstationId = newId();
        this.newNodeHelp = true;
        this.showLabels = true;
        this.debug = false;
        this.textLabels = true;
        this.showConnectorActivity = true;
        this.showMap = false;
        this.useLocalStorage = true;
        this.showRemoteMouseMovements = true;
        this.maxConnectorActivity = 100;
        this.newNodeOffset = {x: 100, y: 100, z: 0};
        this.defaultNewGraphTemplate = defaultNewGraphTemplate;
        this.defaultNewSetTemplate = defaultNewSetTemplate;
        this.defaultNewVueTemplate = defaultNewVueTemplate;
        this.graphWSSServer = "";
        this.graphHTTPServer = "";
        this.snapToGrid = true;
        this.gridSize = 10;
        this.appearance = new Appearance();
        this.uiSize = {};
        this.remoteConfiguration = "https://unpkg.com/@plastic-io/registry/package.json";
        this.registries = '';
        this.componentScripts = '';
    }
}
export default abstract class PreferencesProvider {
  asyncUpdate: boolean;
  constructor() {
      this.asyncUpdate = false;
  }
  abstract subscribe(callback: (e: Event, prefs: UserPreferences) => void): Promise<void>;
  abstract get(): Promise<UserPreferences>;
  abstract set(value: UserPreferences): Promise<void>;
  abstract delete(): Promise<void>;
}

