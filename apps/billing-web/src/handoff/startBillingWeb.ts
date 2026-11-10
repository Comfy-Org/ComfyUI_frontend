import { CLOUD_BASE_URL } from '@/config/env'
import type { HandoffCapture } from '@/handoff/captureHandoffToken'
import { runHandoffBootstrap } from '@/handoff/handoffBootstrap'
import { endHandoffAtExpiry, sessionTabStorage } from '@/handoff/handoffTab'

/** Settles this tab's handoff, then loads the app and its telemetry. */
export async function startBillingWeb(
  capture: Extract<HandoffCapture, { kind: 'captured' }>
): Promise<void> {
  await runHandoffBootstrap({
    capture,
    storage: sessionTabStorage,
    fetchImpl: (...args) => window.fetch(...args),
    cloudBaseUrl: CLOUD_BASE_URL,
    now: () => Date.now()
  })
  endHandoffAtExpiry(sessionTabStorage)
  await import('@/main')
}
