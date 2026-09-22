import { createApp } from 'vue'
import { expect, it, vi } from 'vitest'

const sentryInit = vi.hoisted(() => vi.fn())

vi.mock(import('@sentry/vue'), () => ({
  browserApiErrorsIntegration: vi.fn(),
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
