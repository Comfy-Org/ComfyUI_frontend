import { expect, it } from 'vitest'
import { bindAnalyticsConsentRuntime as sharedRuntime } from '@comfyorg/account-core/analyticsConsentRuntime'
import { createAnalyticsConsentReceiptBridge as sharedBridge } from '@comfyorg/account-core/analyticsConsentReceiptBridge'
import { bindAnalyticsConsentRuntime } from './analyticsConsentRuntime'
import { createAnalyticsConsentReceiptBridge } from './analyticsConsentReceiptBridge'

it('keeps existing API-client imports on the shared account implementation', () => {
  expect(bindAnalyticsConsentRuntime).toBe(sharedRuntime)
  expect(createAnalyticsConsentReceiptBridge).toBe(sharedBridge)
})
