import type {
  browserApiErrorsIntegration as sentryBrowserApiErrorsIntegration,
  init as sentryInitContract
} from '@sentry/vue'
import { fromPartial } from '@total-typescript/shoehorn'
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
it('installs the third-party error filter in the send sanitizer', () => {
  initSentry({
    app: createApp({}),
    dsn: 'https://public@example.invalid/1',
    enabled: true,
    isCloud: false
  })

  const options = sentryInit.mock.calls.at(-1)?.[0]
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

it('redacts URL secrets from events, breadcrumbs, and spans', () => {
  initSentry({
    app: createApp({}),
    dsn: 'https://public@example.invalid/1',
    enabled: true,
    isCloud: true
  })

  const options = sentryInit.mock.calls.at(-1)?.[0]
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
        request: { url: secretUrl },
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
    request: { url: 'https://example.com/model.glb' },
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
          sources: [secretUrl, 42, null, 'safe'] as unknown as string[]
        },
        description: `GET ${secretUrl}`,
        span_id: '1234567890abcdef',
        start_timestamp: 1,
        trace_id: '1234567890abcdef1234567890abcdef'
      })
    )
  ).toMatchObject({
    description: 'GET https://example.com/model.glb',
    data: {
      source: 'https://example.com/model.glb',
      sources: ['https://example.com/model.glb', 42, null, 'safe']
    }
  })
})
