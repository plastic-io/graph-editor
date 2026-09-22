import PreferencesProvider, {UserPreferences, useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
import {applyChange, diff} from "deep-diff";
import {deref} from "@plastic-io/graph-editor-vue3-utils";
const STORE_KEY = 'plastic-user-preferences';

/** Everything the stored copy says, and the defaults for everything it does not. */
function withDefaults(defaults: any, stored: any): any {
  if (stored === null || stored === undefined) {
    return defaults;
  }
  if (typeof defaults !== "object" || defaults === null
      || Array.isArray(defaults) || Array.isArray(stored)
      || typeof stored !== "object") {
    return stored;
  }
  const out: Record<string, any> = {...stored};
  Object.keys(defaults).forEach((key) => {
    out[key] = key in stored ? withDefaults(defaults[key], stored[key]) : defaults[key];
  });
  // the canvas background was called `background` until 2026-09-21
  if (out.backgroundColor === undefined && typeof stored.background === "string") {
    out.backgroundColor = stored.background;
  }
  return out;
}
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
    const defaults = new UserPreferences();
    const item = localStorage.getItem(STORE_KEY);
    if (!item) {
      return defaults;
    }
    // What was saved was whatever UserPreferences looked like that day.  A
    // setting added since is missing from it, and reading one that isn't
    // there breaks the panel that asks for it, so the defaults fill the gaps.
    return withDefaults(defaults, JSON.parse(item));
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
