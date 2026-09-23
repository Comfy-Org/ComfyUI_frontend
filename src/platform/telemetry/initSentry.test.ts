import type {
  browserApiErrorsIntegration as sentryBrowserApiErrorsIntegration,
  init as sentryInitContract
} from '@sentry/vue'
import { expect, it, vi } from 'vitest'
import { createApp } from 'vue'

const { sentryInit, browserApiErrorsIntegration } = vi.hoisted(() => ({
  sentryInit: vi.fn<typeof sentryInitContract>(),
  browserApiErrorsIntegration: vi.fn<typeof sentryBrowserApiErrorsIntegration>()
}))

vi.mock(import('@sentry/vue'), () => ({
  browserApiErrorsIntegration,
  init: sentryInit
}))

import { initSentry } from './initSentry'
import { sentryThirdPartyErrorFilter } from './thirdPartyErrorNoise'

it('installs the third-party error filter', () => {
  initSentry({
    app: createApp({}),
    dsn: 'https://public@example.invalid/1',
    enabled: true,
    isCloud: false
  })

  expect(sentryInit).toHaveBeenCalledWith(
    expect.objectContaining({ beforeSend: sentryThirdPartyErrorFilter })
  )
})
