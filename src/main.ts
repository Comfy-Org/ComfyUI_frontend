import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import * as Sentry from '@sentry/vue'
import { initializeApp } from 'firebase/app'
import { createPinia } from 'pinia'
import 'primeicons/primeicons.css'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createApp } from 'vue'
import { VueFire, VueFireAuth } from 'vuefire'

import { setAssertReporter } from '@/base/assert'
import { getFirebaseConfig } from '@/config/firebase'
import { flushProxyWidgetMigration } from '@/core/graph/subgraph/migration/proxyWidgetMigration'
import { autoExposeKnownPreviewNodes } from '@/core/graph/subgraph/promotionUtils'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  configValueOrDefault,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { syncHostUserIdWithFirebaseAuth } from '@/platform/telemetry/hostUserIdSync'
import '@/lib/litegraph/public/css/litegraph.css'
import router from '@/router'
import { isDesktop, isNightly } from '@/platform/distribution/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useBootstrapStore } from '@/stores/bootstrapStore'

import App from './App.vue'
// Intentionally relative import to ensure the CSS is loaded in the right order (after litegraph.css)
import './assets/css/style.css'
import { i18n } from './i18n'

const isCloud = __DISTRIBUTION__ === 'cloud'
const hasHostTelemetryBridge = Boolean(window.__comfyDesktop2?.Telemetry)

// Load remote config before initializeApp() below, so getFirebaseConfig() resolves
// against the server's runtime values instead of the build-time defaults.
const { refreshRemoteConfig } =
  await import('@/platform/remoteConfig/refreshRemoteConfig')
await refreshRemoteConfig({ useAuth: false })

if (isCloud) {
  const { initTelemetry } = await import('@/platform/telemetry/initTelemetry')
  await initTelemetry()
}

if (hasHostTelemetryBridge) {
  const { initHostTelemetry } =
    await import('@/platform/telemetry/initHostTelemetry')
  initHostTelemetry()
}

const ComfyUIPreset = definePreset(Aura, {
  semantic: {
    // @ts-expect-error fixme ts strict error
    primary: Aura['primitive'].blue
  }
})

const firebaseApp = initializeApp(getFirebaseConfig())

const app = createApp(App)
const pinia = createPinia()

const sentryDsn = isCloud
  ? configValueOrDefault(remoteConfig.value, 'sentry_dsn', __SENTRY_DSN__)
  : __SENTRY_DSN__

Sentry.init({
  app,
  dsn: sentryDsn,
  enabled: __SENTRY_ENABLED__,
  release: __COMFYUI_FRONTEND_VERSION__,
  normalizeDepth: 8,
  tracesSampleRate: isCloud ? 1.0 : 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  // Only set these for non-cloud builds
  ...(isCloud
    ? {
        integrations: [
          // Disable event target wrapping to reduce overhead on high-frequency
          // DOM events (pointermove, mousemove, wheel). Sentry still captures
          // errors via window.onerror and unhandledrejection.
          Sentry.browserApiErrorsIntegration({ eventTarget: false })
        ]
      }
    : {
        integrations: [],
        autoSessionTracking: false,
        defaultIntegrations: false
      })
})

if (isCloud && __SENTRY_ENABLED__) {
  window.Sentry = Sentry
}

// Assertion reporter receives pre-formatted messages (with "[Assertion failed]: " prefix).
// Strings here are intentionally not i18n'd: they're developer/nightly diagnostics,
// not user-facing in stable releases.
setAssertReporter((message) => {
  if (isDesktop) {
    Sentry.captureMessage(message, { level: 'warning' })
  }
  if (isNightly) {
    useToastStore(pinia).add({
      severity: 'warn',
      summary: 'Assertion failed',
      detail: message
    })
  }
})

app.directive('tooltip', Tooltip)
app
  .use(router)
  .use(PrimeVue, {
    zIndex: {
      modal: 1800,
      overlay: 1800,
      menu: 1800,
      // Tooltips sit above modals/menus so a menu-item tooltip isn't hidden
      // behind a body-portaled dropdown that lifts itself to modal + 1.
      tooltip: 2000
    },
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
  .use(ToastService)
  .use(pinia)
  .use(i18n)
  .use(VueFire, {
    firebaseApp,
    modules: [VueFireAuth()]
  })

if (isCloud && hasHostTelemetryBridge) {
  syncHostUserIdWithFirebaseAuth()
}

LGraph.proxyWidgetMigrationFlush = (hostNode, nodeData) =>
  flushProxyWidgetMigration({
    hostNode,
    hostWidgetValues: nodeData?.widgets_values
  })

LGraph.autoExposePreviewNodes = (hostNode) =>
  autoExposeKnownPreviewNodes(hostNode)

const bootstrapStore = useBootstrapStore(pinia)
void bootstrapStore.startStoreBootstrap()

app.mount('#vue-app')
