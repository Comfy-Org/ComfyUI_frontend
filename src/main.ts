import { captureMessage } from '@sentry/vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import 'primeicons/primeicons.css'
import { createApp } from 'vue'
import type { App as VueApp } from 'vue'

import { setAssertReporter } from '@comfyorg/shared-frontend-utils/assert'
import { flushProxyWidgetMigration } from '@/core/graph/subgraph/migration/proxyWidgetMigration'
import { autoExposeKnownPreviewNodes } from '@/core/graph/subgraph/promotionUtils'
import { LGraph } from '@comfyorg/litegraph/litegraph'
import { provideTranslator } from '@comfyorg/litegraph/translate'
import { installCloudApiAuth } from '@/platform/auth/cloudApiAuthProvider'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import {
  configValueOrDefault,
  useRemoteConfigStore
} from '@/platform/remoteConfig/remoteConfigStore'
import { reportAssertFailure } from '@/platform/telemetry/assertFailureReporter'
import { reportFirebaseConfigSource } from '@/platform/telemetry/firebaseConfigSourceTelemetry'
import { initSentry } from '@/platform/telemetry/initSentry'
import {
  markStoresPending,
  markStoresReady
} from '@/platform/telemetry/storeReadiness'
import { syncHostUserIdWithFirebaseAuth } from '@/platform/telemetry/hostUserIdSync'
import '@/platform/telemetry/initErrorReporter'
import { flushErrorReports } from '@comfyorg/telemetry/reportError'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import '@comfyorg/litegraph/litegraph.css'
import { createAppRouter } from '@/router'
import { captureSafeExtensionBoot } from '@/platform/customNodes/safeExtensionBoot'
import { isDesktop, isNightly } from '@/platform/distribution/types'
import { stripPaymentReturnParams } from '@/platform/billing/subscription/utils/paymentReturnUrl'
import { useToast } from '@/components/ui/toast/toastStore'
import { createToastId } from '@/types/toastId'
import { installWorkspaceApiAuth } from '@/platform/workspace/api/workspaceApiAuth'
import { api } from '@/scripts/api'
import { useBootstrapStore } from '@/stores/bootstrapStore'
import { attachLegacyUI } from '@/core/legacyUI/attachLegacyUI'
import { handleDesktopWorkflowHandoff } from '@/platform/openOnCloud/desktopWorkflowRelay'
import { startLocalOpenOnCloudRollout } from '@/platform/openOnCloud/localOpenOnCloudRollout'

import App from './App.vue'
// Intentionally relative import to ensure the CSS is loaded in the right order (after litegraph.css)
import './assets/css/style.css'
import { i18n, st, syncDocumentLanguage, t } from './i18n'
import { installTranslationSafeDomOps } from '@/base/dom/translationSafeDomOps'

const isCloud = __DISTRIBUTION__ === 'cloud'
const hasHostTelemetryBridge = Boolean(window.__comfyDesktop2?.Telemetry)

async function loadRemoteConfigBeforeFirebase(): Promise<void> {
  await bootstrapTracer.settle('startup/remote-config', async () => {
    const { loadRemoteConfigUntilReady, refreshRemoteConfig } =
      await import('@/platform/remoteConfig/refreshRemoteConfig')
    if (isCloud) await loadRemoteConfigUntilReady()
    else await refreshRemoteConfig({ useAuth: false })
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

async function startLocalAuthSession(): Promise<boolean> {
  if (isCloud) return false
  return bootstrapTracer.settle('startup/local-auth', async () => {
    const desktopHostAuth = window.__comfyDesktop2?.Auth
    if (desktopHostAuth) {
      const { startDesktopHostSession } =
        await import('@/platform/auth/desktopHost/desktopHostSession')
      await startDesktopHostSession(desktopHostAuth)
      return false
    }
    const { startLocalWebSession } =
      await import('@/platform/auth/localWeb/localWebSession')
    const signInNotice = createToastId()
    const started = await startLocalWebSession({
      onPopupBlocked: () =>
        useToast().error(t('auth.desktopHost.popupBlocked'), {
          id: signInNotice
        }),
      onSignInFailed: () =>
        useToast().error(t('auth.desktopHost.signInFailed'), {
          id: signInNotice
        })
    })
    return started === 'sign-in-failed'
  })
}

function showLocalSignInFailure(pinia: Pinia, failed: boolean): void {
  if (failed) useToast(pinia).error(t('auth.desktopHost.signInFailed'))
}

function startLocalBillingWebFlag(pinia: Pinia): void {
  if (isCloud) return
  void import('@/platform/billing/stores/localBillingWebFlagStore').then(
    ({ useLocalBillingWebFlagStore }) => useLocalBillingWebFlagStore(pinia)
  )
}

async function startLocalOpenOnCloud(pinia: Pinia): Promise<void> {
  if (isCloud) return
  const { useAuthStore } = await import('@/stores/authStore')
  const authStore = useAuthStore(pinia)
  const stop = startLocalOpenOnCloudRollout(
    () => authStore.userId,
    async () =>
      (await authStore.getIdToken()) ??
      (await authStore.getWorkspaceAuthToken())
  )
  import.meta.hot?.dispose(stop)
}

function initFirebaseIdentity(): void {
  const phaseFirebase = bootstrapTracer.startPhase('startup/firebase-init')
  try {
    firebaseIdentity.initialize()
  } finally {
    phaseFirebase.stop()
    if (isCloud) reportFirebaseConfigSource()
  }
}

function resolveRuntimeSentryDsn(): string {
  return isCloud
    ? configValueOrDefault(
        useRemoteConfigStore().config,
        'sentry_dsn',
        __SENTRY_DSN__
      )
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

async function bootstrap(pinia: Pinia): Promise<void> {
  bootstrapTracer.recordSinceTimeOrigin('startup/entry-modules')
  api.captureLaunchContext()
  captureSafeExtensionBoot()

  if (isCloud) {
    stripPaymentReturnParams()
    installCloudApiAuth()
  }
  installWorkspaceApiAuth()

  bootstrapTracer.armWatchdog()

  await loadRemoteConfigBeforeFirebase()

  markStoresPending()

  await startTelemetry()
  const localSignInFailed = await startLocalAuthSession()
  initFirebaseIdentity()

  const router = await bootstrapTracer.settle('startup/router', createAppRouter)
  installTranslationSafeDomOps()
  syncDocumentLanguage()
  const app = createApp(App)

  initErrorReporting(app, pinia)

  app.use(router).use(pinia).use(i18n)

  markStoresReady()

  showLocalSignInFailure(pinia, localSignInFailed)
  startLocalBillingWebFlag(pinia)
  void startLocalOpenOnCloud(pinia)

  if (isCloud && hasHostTelemetryBridge) {
    syncHostUserIdWithFirebaseAuth()
  }

  installSubgraphGraphHooks()
  provideTranslator(st)

  void useBootstrapStore(pinia).startStoreBootstrap()

  const detachLegacyUI = attachLegacyUI()
  import.meta.hot?.dispose(detachLegacyUI)

  app.mount('#vue-app')
  bootstrapTracer.milestone('app-mounted')
}

const pinia = createPinia()
setActivePinia(pinia)
if (!(await handleDesktopWorkflowHandoff())) await bootstrap(pinia)
