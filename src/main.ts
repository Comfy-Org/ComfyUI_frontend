import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import * as Sentry from '@sentry/vue'
import { initializeApp } from 'firebase/app'
import { createPinia } from 'pinia'
import 'primeicons/primeicons.css'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createApp } from 'vue'
import { VueFire, VueFireAuth } from 'vuefire'

import { FIREBASE_CONFIG } from '@/config/firebase'
import '@/lib/litegraph/public/css/litegraph.css'
import router from '@/router'

import App from './App.vue'
// Intentionally relative import to ensure the CSS is loaded in the right order (after litegraph.css)
import './assets/css/style.css'
import { i18n } from './i18n'

/**
 * CRITICAL: Load remote config FIRST for cloud builds to ensure
 * window.__CONFIG__is available for all modules during initialization
 */
import { isCloud } from '@/platform/distribution/types'

if (isCloud) {
  const { loadRemoteConfig } = await import(
    '@/platform/remoteConfig/remoteConfig'
  )
  await loadRemoteConfig()
}

const ComfyUIPreset = definePreset(Aura, {
  semantic: {
    // @ts-expect-error fixme ts strict error
    primary: Aura['primitive'].blue
  }
})

const firebaseApp = initializeApp(FIREBASE_CONFIG)

const app = createApp(App)
const pinia = createPinia()
Sentry.init({
  app,
  dsn: __SENTRY_DSN__,
  enabled: __SENTRY_ENABLED__,
  release: __COMFYUI_FRONTEND_VERSION__,
  integrations: [],
  autoSessionTracking: false,
  defaultIntegrations: false,
  normalizeDepth: 8,
  tracesSampleRate: 0
})
app.directive('tooltip', Tooltip)
app
  .use(router)
  .use(PrimeVue, {
    theme: {
      preset: ComfyUIPreset,
      options: {
        prefix: 'p',
        cssLayer: {
          name: 'primevue',
          order: 'theme, base, primevue'
        },
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
  .use(VueFire, {
    firebaseApp,
    modules: [VueFireAuth()]
  })

// Register auth service worker after Pinia is initialized (cloud-only)
// Wait for registration to complete before mounting to ensure SW controls the page
if (isCloud) {
  await import('@/platform/auth/serviceWorker')
}

app.mount('#vue-app')
