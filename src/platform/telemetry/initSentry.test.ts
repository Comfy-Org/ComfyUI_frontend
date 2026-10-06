import type { Event } from '@sentry/vue'
import {
  BrowserClient,
  defaultStackParser,
  init as sentryInit,
  makeFetchTransport
} from '@sentry/vue'
import { createApp } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock(import('@sentry/vue'), { spy: true })

import { initSentry } from './initSentry'
import { sentryThirdPartyErrorFilter } from './thirdPartyErrorNoise'

function initOptions(isCloud: boolean) {
  initSentry({
    app: createApp({}),
    dsn: 'https://public@example.invalid/1',
    enabled: true,
    isCloud
  })
  return vi.mocked(sentryInit).mock.lastCall![0]!
}

function eventFrom(filename: string) {
  return {
    exception: {
      values: [
        {
          type: 'Error',
          value: 'boom',
          stacktrace: { frames: [{ filename }] }
        }
      ]
    }
  }
}

beforeEach(() => {
  vi.mocked(sentryInit).mockReset().mockReturnValue(undefined)
})

it.for([true, false])(
  'installs the third-party error filter (isCloud: %s)',
  (isCloud) => {
    expect(initOptions(isCloud).beforeSend).toBe(sentryThirdPartyErrorFilter)
  }
)

it('keeps Sentry default integrations enabled on cloud so denyUrls is honoured', () => {
  expect(initOptions(true).defaultIntegrations).not.toBe(false)
})

function nonCloudFilter(event: Event) {
  const options = initOptions(false)
  const client = new BrowserClient({
    stackParser: defaultStackParser,
    transport: makeFetchTransport,
    integrations: [],
    denyUrls: options.denyUrls
  })
  const integrations = Array.isArray(options.integrations)
    ? options.integrations
    : []
  return integrations.reduce<Event | null | PromiseLike<Event | null>>(
    (current, integration) =>
      current && integration.processEvent
        ? integration.processEvent(current as Event, {}, client)
        : current,
    event
  )
}

it('disables default integrations on non-cloud builds', () => {
  expect(initOptions(false).defaultIntegrations).toBe(false)
})

it.for([
  'chrome-extension://abcdef/content.js',
  'moz-extension://abcdef/content.js',
  'safari-extension://abcdef/content.js',
  'safari-web-extension://abcdef/content.js',
  'ms-browser-extension://abcdef/content.js'
])('drops non-cloud errors whose stack originates in %s', (filename) => {
  expect(nonCloudFilter(eventFrom(filename))).toBeNull()
})

it('keeps non-cloud errors from first-party scripts', () => {
  const event = eventFrom('https://example.com/assets/index.js')
  expect(nonCloudFilter(event)).toBe(event)
})
