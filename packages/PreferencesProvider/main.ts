import getRandomName from "@plastic-io/graph-editor-names"
import {newId} from "@plastic-io/graph-editor-vue3-utils";
import {Appearance} from "@plastic-io/graph-editor-vue3-graph-canvas"; 
import {NodeLocation} from "@plastic-io/graph-editor-vue3-node"; 
const defaultNewSetTemplate = "console.info(value)";
const defaultNewVueTemplate = `<template>
    <div>
        New Node
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
<style>
</style>
`;
const defaultNewGraphTemplate = `<template>
    <div>
        <graph-node
            v-for="node in graph.nodes"
            :key="node.id"
            :node="node"
            :graph="graph"
        ></graph-node>
    </div>
</template>
<script>
    export default {
        props: {
            graph: Object,
        },
    }
</script>
`;
export class UserPreferences {
    userName: string;
    email: string;
    userId: string;
    avatar: string;
    workstationId: string;
    newNodeHelp: boolean;
    showLabels: boolean;
    debug: boolean;
    showMap: boolean;
    useLocalStorage: boolean;
    showRemoteMouseMovements: boolean;
    maxConnectorActivity: number;
    newNodeOffset: NodeLocation;
    defaultNewGraphTemplate: string;
    defaultNewSetTemplate: string;
    defaultNewVueTemplate: string;
    snapToGrid: boolean;
    gridSize: number;
    appearance: Appearance;
    constructor() {
        this.userName = getRandomName();
        this.email = "";
        this.userId = '0';
        this.avatar = "https://api.adorable.io/avatars/50/" + this.userName.replace(/ /g, "") + ".png";
        this.workstationId = newId();
        this.newNodeHelp = true;
        this.showLabels = true;
        this.debug = false;
        this.showMap = false;
        this.useLocalStorage = true;
        this.showRemoteMouseMovements = true;
        this.maxConnectorActivity = 100;
        this.newNodeOffset = new NodeLocation(100, 100, 0);
        this.defaultNewGraphTemplate = defaultNewGraphTemplate;
        this.defaultNewSetTemplate = defaultNewSetTemplate;
        this.defaultNewVueTemplate = defaultNewVueTemplate;
        this.snapToGrid = true;
        this.gridSize = 10;
        this.appearance = new Appearance();
    }
}
export default abstract class PreferencesProvider {
  asyncUpdate: boolean;
  defaultPreferences: UserPreferences;
  constructor() {
      this.asyncUpdate = false;
      this.defaultPreferences = new UserPreferences();
  }
  abstract subscribe(callback: (e: Event, prefs: UserPreferences) => void): Promise<void>;
  abstract get(): Promise<UserPreferences>;
  abstract set(value: UserPreferences): Promise<void>;
  abstract delete(): Promise<void>;
}
