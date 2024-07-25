import App from './App.vue'
import { createApp } from 'vue'
import router from '@/router'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createPinia } from 'pinia'
import { i18n } from './i18n'
import 'reflect-metadata'
import 'primeicons/primeicons.css'
import '@comfyorg/litegraph/css/litegraph.css'
import '@/assets/css/style.css'

const ComfyUIPreset = definePreset(Aura, {
  semantic: {
    // @ts-ignore
    primary: Aura.primitive.blue
  }
})

const app = createApp(App)
const pinia = createPinia()

app.directive('tooltip', Tooltip)

app.use(PrimeVue, {
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

app.use(router)
app.use(ConfirmationService)
app.use(ToastService)
app.use(pinia)
app.use(i18n)
app.mount('#vue-app')
