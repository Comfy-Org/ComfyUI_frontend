import type { Event } from '@sentry/vue'
import {
  BrowserClient,
  defaultStackParser,
  init as sentryInit,
  makeFetchTransport
} from '@sentry/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { createApp } from 'vue'
import { assert, beforeEach, expect, it, vi } from 'vitest'

vi.mock(import('@sentry/vue'), { spy: true })

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'

import { initSentry } from './initSentry'

beforeEach(() => {
  vi.mocked(sentryInit).mockReturnValue(undefined)
})

function initOptions(isCloud: boolean) {
  initSentry({
    app: createApp({}),
    dsn: 'https://public@example.invalid/1',
    enabled: true,
    isCloud
  })
  return vi.mocked(sentryInit).mock.lastCall![0]!
}

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

it('keeps Sentry default integrations enabled on cloud', () => {
  expect(initOptions(true).defaultIntegrations).not.toBe(false)
})

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

it('installs the third-party error filter in the send sanitizer', () => {
  initSentry({
    app: createApp({}),
    dsn: 'https://public@example.invalid/1',
    enabled: true,
    isCloud: false
  })

  const options = vi.mocked(sentryInit).mock.calls.at(-1)?.[0]
  const beforeSend = options?.beforeSend
  expect(
    beforeSend?.(
      fromPartial({
        message: 'Invalid call to runtime.sendMessage(). Tab not found.'
      }),
      {}
    )
  ).toBeNull()
})

it('groups WorkspaceApiError events in the send sanitizer', () => {
  const error = new WorkspaceApiError(
    'Request failed',
    503,
    'unavailable',
    undefined,
    'listWorkspaces'
  )

  expect(
    initOptions(true).beforeSend?.(fromPartial({}), {
      originalException: error
    })
  ).toMatchObject({
    fingerprint: ['WorkspaceApiError', 'listWorkspaces', '503', 'unavailable']
  })
})

it('redacts URL secrets from events, breadcrumbs, and spans', () => {
  initSentry({
    app: createApp({}),
    dsn: 'https://public@example.invalid/1',
    enabled: true,
    isCloud: true
  })

  const options = vi.mocked(sentryInit).mock.calls.at(-1)?.[0]
  const secretUrl = 'https://user:secret@example.com/model.glb?token=private'
  expect(
    options?.beforeBreadcrumb?.({
      message: `fetch ${secretUrl}`,
      data: { url: secretUrl }
    })
  ).toMatchObject({
    message: 'fetch https://example.com/model.glb',
    data: { url: 'https://example.com/model.glb' }
  })
  expect(
    options?.beforeSend?.(
      fromPartial({
        tags: { source: secretUrl },
        extra: { source: secretUrl },
        contexts: { model: { source: secretUrl } },
        request: {
          url: secretUrl,
          query_string: `next=${secretUrl}`,
          data: { source: secretUrl },
          headers: { referer: secretUrl }
        },
        exception: {
          values: [
            {
              type: `AssetError ${secretUrl}`,
              value: `failed ${secretUrl}`,
              stacktrace: {
                frames: [{ filename: secretUrl, abs_path: secretUrl }]
              }
            }
          ]
        }
      }),
      {}
    )
  ).toMatchObject({
    tags: { source: 'https://example.com/model.glb' },
    extra: { source: 'https://example.com/model.glb' },
    contexts: { model: { source: 'https://example.com/model.glb' } },
    request: {
      url: 'https://example.com/model.glb',
      query_string: 'next=https://example.com/model.glb',
      data: { source: 'https://example.com/model.glb' },
      headers: { referer: 'https://example.com/model.glb' }
    },
    exception: {
      values: [
        {
          type: 'AssetError https://example.com/model.glb',
          value: 'failed https://example.com/model.glb',
          stacktrace: {
            frames: [
              {
                filename: 'https://example.com/model.glb',
                abs_path: 'https://example.com/model.glb'
              }
            ]
          }
        }
      ]
    }
  })
  expect(
    options?.beforeSendSpan?.(
      fromPartial({
        data: {
          source: secretUrl,
          sources: [secretUrl, null, 'safe']
        },
        description: `GET ${secretUrl}`,
        span_id: '1234567890abcdef',
        start_timestamp: 1,
        trace_id: '1234567890abcdef1234567890abcdef',
        links: [
          {
            trace_id: '1234567890abcdef1234567890abcdef',
            span_id: '1234567890abcdef',
            sampled: true,
            attributes: { source: secretUrl }
          }
        ]
      })
    )
  ).toMatchObject({
    description: 'GET https://example.com/model.glb',
    data: {
      source: 'https://example.com/model.glb',
      sources: ['https://example.com/model.glb', null, 'safe']
    },
    links: [{ attributes: { source: 'https://example.com/model.glb' } }]
  })
})

it('redacts URL secrets from sampled transactions', () => {
  initSentry({
    app: createApp({}),
    dsn: 'https://public@example.invalid/1',
    enabled: true,
    isCloud: true
  })

  const options = vi.mocked(sentryInit).mock.calls.at(-1)?.[0]
  const secretUrl = 'https://user:secret@example.com/model.glb?token=private'
  assert.exists(options?.beforeSendTransaction)

  expect(
    options.beforeSendTransaction(
      fromPartial({
        type: 'transaction',
        transaction: '/callback?code=private',
        tags: { source: secretUrl },
        extra: { source: secretUrl },
        contexts: {
          trace: { trace_id: 'abc', span_id: 'def', source: secretUrl }
        },
        request: { url: secretUrl, headers: { Referer: secretUrl } }
      }),
      {}
    )
  ).toMatchObject({
    transaction: '/callback',
    tags: { source: 'https://example.com/model.glb' },
    extra: { source: 'https://example.com/model.glb' },
    contexts: {
      trace: {
        trace_id: 'abc',
        span_id: 'def',
        source: 'https://example.com/model.glb'
      }
    },
    request: {
      url: 'https://example.com/model.glb',
      headers: { Referer: 'https://example.com/model.glb' }
    }
  })
})
