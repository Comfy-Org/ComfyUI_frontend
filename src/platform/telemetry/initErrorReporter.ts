import { captureException, isEnabled as isSentryEnabled } from '@sentry/vue'

import { configureErrorReporter } from '@comfyorg/telemetry/reportError'

import { isCloud } from '@/platform/distribution/types'

import { isHostTelemetryEnabled } from './hostTelemetryEnabled'

configureErrorReporter({
  captureException,
  isSentryEnabled,
  isCloud: () => isCloud,
  isHostTelemetryEnabled,
  getDesktopTelemetry: () => window.__comfyDesktop2?.Telemetry
})
