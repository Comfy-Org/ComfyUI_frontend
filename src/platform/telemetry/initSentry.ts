import { browserApiErrorsIntegration, init as sentryInit } from '@sentry/vue'
import type { App } from 'vue'

import { sentryThirdPartyErrorFilter } from './thirdPartyErrorNoise'

export function initSentry({
  app,
  dsn,
  enabled,
  isCloud
}: {
  app: App
  dsn: string
  enabled: boolean
  isCloud: boolean
}) {
  sentryInit({
    app,
    dsn,
    enabled,
    release: __COMFYUI_FRONTEND_VERSION__,
    normalizeDepth: 8,
    tracesSampleRate: isCloud ? 1.0 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: sentryThirdPartyErrorFilter,
    // Only set these for non-cloud builds
    ...(isCloud
      ? {
          integrations: [
            // Disable event target wrapping to reduce overhead on high-frequency
            // DOM events (pointermove, mousemove, wheel). Sentry still captures
            // errors via window.onerror and unhandledrejection.
            browserApiErrorsIntegration({ eventTarget: false })
          ]
        }
      : {
          integrations: [],
          autoSessionTracking: false,
          defaultIntegrations: false
        })
  })
}
