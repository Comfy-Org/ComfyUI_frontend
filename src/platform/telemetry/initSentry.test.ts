import type {
  browserApiErrorsIntegration as sentryBrowserApiErrorsIntegration,
  init as sentryInitContract
} from '@sentry/vue'
import { createApp } from 'vue'
import { expect, it, vi } from 'vitest'

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

it('denies errors whose stack originates in a browser extension', () => {
  initSentry({
    app: createApp({}),
    dsn: 'https://public@example.invalid/1',
    enabled: true,
    isCloud: false
  })

  const { denyUrls } = sentryInit.mock.lastCall![0]!
  const isDenied = (url: string) =>
    (denyUrls ?? []).some((pattern) =>
      typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)
    )

  expect(
    [
      'chrome-extension://abcdef/content.js',
      'moz-extension://abcdef/content.js',
      'safari-web-extension://abcdef/content.js'
    ].every(isDenied)
  ).toBe(true)
  expect(isDenied('https://cloud.comfy.org/assets/index.js')).toBe(false)
})
