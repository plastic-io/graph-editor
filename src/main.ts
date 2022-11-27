// core files
import { createApp } from "vue";
import { createPinia, defineStore } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";
// plugins
import workspace from "@plastic-io/workspace";
import systemBar from "@plastic-io/system-bar";

const app = createApp(App);
const pinia = createPinia();

// must come before plugins
app.use(pinia);

// add plugins
workspace.install(app, router);
systemBar.install(app, router);

app.use(router);

app.mount("#app");
