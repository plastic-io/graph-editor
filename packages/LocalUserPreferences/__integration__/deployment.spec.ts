import {beforeEach, afterEach, it, expect, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import LocalPreferences from '../main';
import {useStore} from '../../PreferencesProvider/main';

beforeEach(() => {
  vi.useFakeTimers();
  const values = new Map<string,string>();
  vi.stubGlobal('localStorage', {getItem:(key:string)=>values.get(key) || null,
    setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});
  setActivePinia(createPinia());
});
afterEach(() => {vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
it('applies deployment endpoints after both saved preferences and remote registry settings', async () => {
  localStorage.setItem('plastic-user-preferences', JSON.stringify({graphHTTPServer:'https://old.example/',
    graphWSSServer:'wss://old.example/',useLocalStorage:true,remoteConfiguration:'https://registry.example/config'}));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({json:async()=>({appConfig:{graphHTTPServer:'https://registry-api.example/',
    graphWSSServer:'wss://registry-ws.example/',useLocalStorage:true,registries:'https://components.example/'}})}));
  await new LocalPreferences({graphHTTPServer:'https://deployed.example/dev/',graphWSSServer:'wss://deployed-ws.example/dev',
    useLocalStorage:false,authenticationRequired:true});
  expect(useStore().preferences).toMatchObject({graphHTTPServer:'https://deployed.example/dev/',graphWSSServer:'wss://deployed-ws.example/dev',
    useLocalStorage:false,authenticationRequired:true,registries:'https://components.example/'});
});
it('keeps existing preferences for builds with no deployment overrides', async () => {
  localStorage.setItem('plastic-user-preferences', JSON.stringify({remoteConfiguration:'',useLocalStorage:true,graphHTTPServer:'https://chosen.example/'}));
  await new LocalPreferences({});
  expect(useStore().preferences).toMatchObject({useLocalStorage:true,graphHTTPServer:'https://chosen.example/'});
});
