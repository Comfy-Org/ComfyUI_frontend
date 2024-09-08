import App from './App.vue'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from './i18n'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'

import '@comfyorg/litegraph/style.css'
import '@/assets/css/style.css'
import '@/assets/css/user.css'
import 'primeicons/primeicons.css'

const ComfyUIPreset = definePreset(Aura, {
  semantic: {
    primary: Aura['primitive'].blue
  }
})

const app = createApp(App)
const pinia = createPinia()
app.directive('tooltip', Tooltip)
app
  .use(PrimeVue, {
    theme: {
      preset: ComfyUIPreset,
      options: {
        prefix: 'p',
        cssLayer: false,
        // This is a workaround for the issue with the dark mode selector
        // https://github.com/primefaces/primevue/issues/5515
        darkModeSelector: '.dark-theme, :root:has(.dark-theme)'
      }
    }
  })
  .use(ConfirmationService)
  .use(ToastService)
  .use(pinia)
  .use(i18n)
  .mount('#vue-app')
