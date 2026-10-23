import { captureMessage } from '@sentry/vue'
import { createPinia } from 'pinia'
import type { Pinia } from 'pinia'
import 'primeicons/primeicons.css'
import { createApp } from 'vue'
import type { App as VueApp } from 'vue'

import { setAssertReporter } from '@/base/assert'
import { flushProxyWidgetMigration } from '@/core/graph/subgraph/migration/proxyWidgetMigration'
import { autoExposeKnownPreviewNodes } from '@/core/graph/subgraph/promotionUtils'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { installCloudApiAuth } from '@/platform/auth/cloudApiAuthProvider'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import {
  configValueOrDefault,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { reportAssertFailure } from '@/platform/telemetry/assertFailureReporter'
import { initSentry } from '@/platform/telemetry/initSentry'
import {
  markStoresPending,
  markStoresReady
} from '@/platform/telemetry/storeReadiness'
import { syncHostUserIdWithFirebaseAuth } from '@/platform/telemetry/hostUserIdSync'
import { flushErrorReports } from '@/platform/telemetry/reportError'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import '@/lib/litegraph/public/css/litegraph.css'
import { createAppRouter } from '@/router'
import { isDesktop, isNightly } from '@/platform/distribution/types'
import { stripPaymentReturnParams } from '@/platform/billing/subscription/utils/paymentReturnUrl'
import { useToast } from '@/components/ui/toast/toastStore'
import { installWorkspaceApiAuth } from '@/platform/workspace/api/workspaceApiAuth'
import { api } from '@/scripts/api'
import { useBootstrapStore } from '@/stores/bootstrapStore'
import { attachLegacyUI } from '@/core/legacyUI/attachLegacyUI'

import App from './App.vue'
// Intentionally relative import to ensure the CSS is loaded in the right order (after litegraph.css)
import './assets/css/style.css'
import { i18n } from './i18n'

const isCloud = __DISTRIBUTION__ === 'cloud'
const hasHostTelemetryBridge = Boolean(window.__comfyDesktop2?.Telemetry)

async function loadRemoteConfigBeforeFirebase(): Promise<void> {
  await bootstrapTracer.settle('startup/remote-config', async () => {
    const { refreshRemoteConfig } =
      await import('@/platform/remoteConfig/refreshRemoteConfig')
    await refreshRemoteConfig({ useAuth: false })
  })
}

async function startTelemetry(): Promise<void> {
  if (isCloud) {
    await bootstrapTracer.settle('startup/telemetry-init', async () => {
      const { initTelemetry } =
        await import('@/platform/telemetry/initTelemetry')
      await initTelemetry()
    })

    const { startFeatureFlagTelemetry } =
      await import('@/composables/useFeatureFlags')
    const stopFeatureFlagTelemetry = startFeatureFlagTelemetry()
    import.meta.hot?.dispose(stopFeatureFlagTelemetry)
  }

  if (hasHostTelemetryBridge) {
    const { initHostTelemetry } =
      await import('@/platform/telemetry/initHostTelemetry')
    initHostTelemetry()
  }
}

async function startLocalAuthSession(): Promise<void> {
  if (isCloud) return
  await bootstrapTracer.settle('startup/local-auth', async () => {
    const desktopHostAuth = window.__comfyDesktop2?.Auth
    if (desktopHostAuth) {
      const { startDesktopHostSession } =
        await import('@/platform/auth/desktopHost/desktopHostSession')
      await startDesktopHostSession(desktopHostAuth)
    } else {
      const { startLocalWebSession } =
        await import('@/platform/auth/localWeb/localWebSession')
      await startLocalWebSession()
    }
  })
}

function initFirebaseIdentity(): void {
  const phaseFirebase = bootstrapTracer.startPhase('startup/firebase-init')
  try {
    firebaseIdentity.initialize()
  } finally {
    phaseFirebase.stop()
  }
}

function resolveRuntimeSentryDsn(): string {
  return isCloud
    ? configValueOrDefault(remoteConfig.value, 'sentry_dsn', __SENTRY_DSN__)
    : __SENTRY_DSN__
}

function initErrorReporting(app: VueApp, pinia: Pinia): void {
  const dsn = resolveRuntimeSentryDsn()
  const phaseSentry = bootstrapTracer.startPhase('startup/sentry-init')
  initSentry({ app, dsn, enabled: !import.meta.env.DEV && !!dsn, isCloud })
  phaseSentry.stop()

  flushErrorReports()

  setAssertReporter(
    (message, context) => {
      if (isDesktop) {
        captureMessage(message, { level: 'warning', extra: context })
      }
      if (isCloud) {
        reportAssertFailure(message, context)
      }
      if (isNightly) {
        useToast(pinia).warning('Assertion failed', { description: message })
      }
    },
    { forwardsToRum: isCloud }
  )
}

function installSubgraphGraphHooks(): void {
  LGraph.proxyWidgetMigrationFlush = (hostNode, nodeData) =>
    flushProxyWidgetMigration({
      hostNode,
      hostWidgetValues: nodeData?.widgets_values
    })

  LGraph.autoExposePreviewNodes = (hostNode) =>
    autoExposeKnownPreviewNodes(hostNode)
}

async function bootstrap(): Promise<void> {
  bootstrapTracer.recordSinceTimeOrigin('startup/entry-modules')
  api.captureLaunchContext()

  if (isCloud) {
    stripPaymentReturnParams()
    installCloudApiAuth()
  }
  installWorkspaceApiAuth()

  bootstrapTracer.armWatchdog()

  await loadRemoteConfigBeforeFirebase()

  markStoresPending()

  await startTelemetry()
  await startLocalAuthSession()
  initFirebaseIdentity()

  const pinia = createPinia()
  const router = await bootstrapTracer.settle('startup/router', createAppRouter)
  const app = createApp(App)

  initErrorReporting(app, pinia)

  app.use(router).use(pinia).use(i18n)

  markStoresReady()

  if (isCloud && hasHostTelemetryBridge) {
    syncHostUserIdWithFirebaseAuth()
  }

  installSubgraphGraphHooks()

  void useBootstrapStore(pinia).startStoreBootstrap()

  const detachLegacyUI = attachLegacyUI()
  import.meta.hot?.dispose(detachLegacyUI)

  app.mount('#vue-app')
  bootstrapTracer.milestone('app-mounted')
}

await bootstrap()
