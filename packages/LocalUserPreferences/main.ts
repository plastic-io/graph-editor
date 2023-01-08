import PreferencesProvider, {UserPreferences, useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
import {applyChange, diff} from "deep-diff";
import {deref} from "@plastic-io/graph-editor-vue3-utils";
const STORE_KEY = 'plastic-user-preferences';
export default class LocalStoragePreferencesProvider extends EditorModule {
  constructor(config: Record<string, any>) {
    super();
    const localPreferencesProvider = new LocalPreferencesProvider();
    const preferencesStore = usePreferencesStore();
    return new Promise((resolve, reject) => {
      // Execute some asynchronous code here
      localPreferencesProvider.get().then(async (userPreferences: UserPreferences) => {
        if (!userPreferences) {
          userPreferences = new UserPreferences();
        }
        preferencesStore.preferences = userPreferences;
        await localPreferencesProvider.init(userPreferences.remoteConfiguration);
        resolve(true);
      });
    }).then(() => {
      // The constructor will return a resolved promise once the asynchronous code has completed
      return this;
    }).catch(err => {
      // Handle the error
      throw err;
    }) as any;
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
  async init(remoteConfiguration: string): Promise<void> {
    const preferencesStore = usePreferencesStore();
    if (remoteConfiguration) {
      const response = await fetch(remoteConfiguration);
      const data = await response.json();
      if (!data && !data.appConfig) {
        console.warn('Remote config has no appConfig key');
        return;
      }
      preferencesStore.remotePreferences = data.appConfig;
      Object.keys(data.appConfig).forEach((key: string) => {
        preferencesStore.$patch((state) => {
          (state.preferences as any)[key] = data.appConfig[key];
        });
      });
      return;
    }
    preferencesStore.remotePreferences = {};
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
