import { createApp } from "vue";
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import { definePreset } from "@primevue/themes";
import "primeicons/primeicons.css";

import App from "./App.vue";
import { app as comfyApp } from "@/scripts/app";

const ComfyUIPreset = definePreset(Aura, {
  semantic: {
    // @ts-ignore
    primary: Aura.primitive.blue,
  },
});

const app = createApp(App);

comfyApp.setup().then(() => {
  window["app"] = comfyApp;
  window["graph"] = comfyApp.graph;

  app
    .use(PrimeVue, {
      theme: {
        preset: ComfyUIPreset,
        options: {
          prefix: "p",
          cssLayer: false,
          // This is a workaround for the issue with the dark mode selector
          // https://github.com/primefaces/primevue/issues/5515
          darkModeSelector: ".dark-theme, :root:has(.dark-theme)",
        },
      },
    })
    .mount("#vue-app");
});
