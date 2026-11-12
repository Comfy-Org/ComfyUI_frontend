import { CLOUD_BASE_URL } from '@/config/env'
import type { HandoffCapture } from '@/handoff/captureHandoffToken'
import { runHandoffBootstrap } from '@/handoff/handoffBootstrap'
import {
  endHandoffAtExpiry,
  sessionTabStorage,
  windowNameMarker
} from '@/handoff/handoffTab'

const EXCHANGE_TIMEOUT_MS = 15_000

export async function startBillingWeb(
  capture: Extract<HandoffCapture, { kind: 'captured' }>
): Promise<void> {
  await runHandoffBootstrap({
    capture,
    storage: sessionTabStorage,
    marker: windowNameMarker,
    fetchImpl: (...args) => window.fetch(...args),
    cloudBaseUrl: CLOUD_BASE_URL,
    now: () => Date.now(),
    exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS
  })
  endHandoffAtExpiry(sessionTabStorage)
  await import('@/main')
}
