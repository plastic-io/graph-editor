import { createApp } from "vue";
import { createPinia } from "pinia";
import workspace from "@plastic-io/workspace";

import App from "./App.vue";
import router from "./router";

import "./assets/main.css";

const app = createApp(App);

// load all plugins


app.use(createPinia());
app.use(router);

app.mount("#app");
