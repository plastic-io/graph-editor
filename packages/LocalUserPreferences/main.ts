import PreferencesProvider, {UserPreferences, useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
const STORE_KEY = 'plastic-user-preferences';
export default class LocalStoragePreferencesProvider extends EditorModule {
  constructor(config: Record<string, any>) {
    super();
    const localPreferencesProvider = new LocalPreferencesProvider();
    const preferencesStore = usePreferencesStore();
    localPreferencesProvider.get().then((userPreferences: UserPreferences) => {
      if (!userPreferences) {
        userPreferences = new UserPreferences();
      }
      preferencesStore.preferences = userPreferences;
    });
  }
};
class LocalPreferencesProvider extends PreferencesProvider {
  asyncUpdate: boolean;
  constructor() {
    super();
    this.asyncUpdate = false;
    const preferencesStore = usePreferencesStore();
    setTimeout(() => {
      preferencesStore.$subscribe((mutation, state) => {
        this.set(state.preferences as UserPreferences);
      }, { detached: true });
    }, 0);
  }
  async get(): Promise<UserPreferences> {
    let item: string = localStorage.getItem(STORE_KEY) ||
      JSON.stringify(new UserPreferences());
    return JSON.parse(item);
  }
  async set(value: UserPreferences): Promise<void> {
    localStorage.setItem(STORE_KEY, JSON.stringify(value));
  }
  async delete(): Promise<void> {
    localStorage.removeItem(STORE_KEY);
  }
  async subscribe(callback: (e: Event, prefs: UserPreferences) => void): Promise<void> {
    window.addEventListener('storage', async (event) => {
      if (event.storageArea === localStorage && event.key === STORE_KEY) {
        callback(event, await this.get());
      }
    });
  };
}
