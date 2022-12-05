import PreferencesProvider, {UserPreferences} from "@plastic-io/graph-editor-vue3-preferences-provider";
import {useStore as useOrchistratorStore} from "@plastic-io/graph-editor-vue3-graph-orchestrator";
import {Appearance} from "@plastic-io/graph-editor-vue3-graph-canvas";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
const STORE_KEY = 'plastic-user-preferences';
export default class LocalStorageDocumentProvider extends GraphEditorModule {
  constructor(config: Record<string, any>) {
    super();
    const localPreferencesProvider = new LocalPreferencesProvider();
    const orchistratorStore = useOrchistratorStore();
    orchistratorStore.dataProviders.preferences = localPreferencesProvider;
    localPreferencesProvider.get().then((userPreferences: UserPreferences) => {
      orchistratorStore.preferences = userPreferences;
    });
  }
};
class LocalPreferencesProvider extends PreferencesProvider {
  asyncUpdate: boolean;
  defaultPreferences: UserPreferences;
  constructor() {
    super();
    this.asyncUpdate = false;
  }
  async get(): Promise<UserPreferences> {
    let item: string = localStorage.getItem(STORE_KEY) ||
      JSON.stringify(new UserPreferences());
    return JSON.parse(item);
  }
  async set(value: UserPreferences): Promise<void> {
    localStorage.setItem(STORE_KEY, value);
  }
  async delete(): Promise<void> {
    localStorage.removeItem(STORE_KEY);
  }
  async subscribe(callback: (e: Event, prefs: UserPreferences) => void): Promise<void> {
    window.addEventListener('storage', (event) => {
      if (event.storageArea === localStorage && event.key === STORE_KEY) {
        callback(event, this.get());
      }
    });
  };
}
