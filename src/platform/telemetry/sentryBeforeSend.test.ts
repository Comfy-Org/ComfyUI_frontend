import type { ErrorEvent } from '@sentry/vue'
import { describe, expect, it } from 'vitest'

import {
  NoWorkspaceAccessError,
  WorkspaceApiError
} from '@/platform/remote/ingest/ingestApiError'

import { sentryBeforeSend } from './sentryBeforeSend'

function eventFor(error: Error): ErrorEvent {
  return {
    type: undefined,
    tags: { surface: 'billing' },
    exception: { values: [{ type: error.name, value: error.message }] }
  }
}

describe('sentryBeforeSend', () => {
  it.for([
    {
      name: 'a server rejection',
      error: new WorkspaceApiError(
        'Bad',
        409,
        'ALREADY_SUBSCRIBED',
        undefined,
        'subscribe'
      ),
      fingerprint: [
        'WorkspaceApiError',
        'subscribe',
        '409',
        'ALREADY_SUBSCRIBED'
      ],
      tags: {
        workspace_api_operation: 'subscribe',
        workspace_api_status: '409',
        workspace_api_code: 'ALREADY_SUBSCRIBED'
      }
    },
    {
      name: 'a request that got no response',
      error: new WorkspaceApiError(
        'Network Error',
        undefined,
        undefined,
        undefined,
        'getBillingStatus'
      ),
      fingerprint: ['WorkspaceApiError', 'getBillingStatus', 'none', 'none'],
      tags: {
        workspace_api_operation: 'getBillingStatus',
        workspace_api_status: 'none',
        workspace_api_code: 'none'
      }
    },
    {
      name: 'a no-workspace refusal',
      error: new NoWorkspaceAccessError('No workspace', 403, 'list'),
      fingerprint: [
        'NoWorkspaceAccessError',
        'list',
        '403',
        'no_workspace_access'
      ],
      tags: {
        workspace_api_operation: 'list',
        workspace_api_status: '403',
        workspace_api_code: 'no_workspace_access'
      }
    }
  ])(
    'groups $name by operation, status and code',
    ({ error, fingerprint, tags }) => {
      expect(
        sentryBeforeSend(eventFor(error), { originalException: error })
      ).toMatchObject({
        fingerprint,
        tags: { surface: 'billing', ...tags }
      })
    }
  )

  it('tags but keeps default grouping when the operation is unknown', () => {
    const error = new WorkspaceApiError('declined', 402, 'card_declined')

    const sent = sentryBeforeSend(eventFor(error), { originalException: error })

    expect(sent?.fingerprint).toBeUndefined()
    expect(sent?.tags).toEqual({
      surface: 'billing',
      workspace_api_status: '402',
      workspace_api_code: 'card_declined'
    })
  })

  it('leaves other errors untouched', () => {
    const error = new Error('boom')
    const event = eventFor(error)

    expect(sentryBeforeSend(event, { originalException: error })).toBe(event)
  })

  it('still drops third-party noise', () => {
    const error = new DOMException('aborted', 'AbortError')

    expect(
      sentryBeforeSend(eventFor(error), { originalException: error })
    ).toBeNull()
  })

  it('adds Vue directive diagnostics to retained events', () => {
    const event = {
      type: undefined,
      exception: {
        values: [
          {
            value: 'undefined is not a function',
            stacktrace: { frames: [{ function: 'withDirectives' }] }
          }
        ]
      }
    } satisfies ErrorEvent

    expect(sentryBeforeSend(event, {})?.tags?.diagnostic).toBe(
      'vue_directive_runtime'
    )
  })

  it('tags a custom extension when it owns the top stack frame', () => {
    const event = {
      type: undefined,
      tags: { surface: 'platform' },
      exception: {
        values: [
          {
            value: "Cannot read properties of null (reading 'readPixels')",
            stacktrace: {
              frames: [
                {
                  abs_path:
                    'https://cloud.comfy.org/extensions/radiance/radiance_viewer.js'
                },
                {
                  filename: '/extensions/radiance/radiance_webgl.js'
                }
              ]
            }
          }
        ]
      }
    } satisfies ErrorEvent

    expect(sentryBeforeSend(event, {})).toMatchObject({
      tags: {
        surface: 'platform',
        error_origin: 'extension',
        extension: 'radiance'
      }
    })
  })

  it('keeps a first-party top frame actionable when an extension appears below it', () => {
    const event = {
      type: undefined,
      exception: {
        values: [
          {
            value: 'Application failed',
            stacktrace: {
              frames: [
                { filename: '/extensions/comfyui-foo/main.js' },
                { filename: 'https://cloud.comfy.org/assets/app.js' }
              ]
            }
          }
        ]
      }
    } satisfies ErrorEvent

    const result = sentryBeforeSend(event, {})
    expect(result).not.toBeNull()
    expect(result?.tags?.error_origin).toBeUndefined()
    expect(result?.tags?.extension).toBeUndefined()
  })

  it.for([
    '/extensions/core/slotDefaults.js',
    '/extensions/cloud/agentPanel.js',
    '../../src/extensions/core/slotDefaults.ts'
  ])('keeps the first-party extension path %s actionable', (filename) => {
    const event = {
      type: undefined,
      exception: {
        values: [
          {
            value: 'Application failed',
            stacktrace: { frames: [{ filename }] }
          }
        ]
      }
    } satisfies ErrorEvent

    const result = sentryBeforeSend(event, {})
    expect(result).not.toBeNull()
    expect(result?.tags?.error_origin).toBeUndefined()
    expect(result?.tags?.extension).toBeUndefined()
  })

  it.for([
    "Cannot destructure property 'useSessionCookie' of '(intermediate value)' as it is undefined.",
    "Cannot read properties of undefined (reading 'useWorkspaceAuthStore')",
    "undefined is not an object (evaluating 'workspaceAuthStore.user')"
  ])(
    'tags an immediate undefined follow-on from a stale chunk: %s',
    (value) => {
      const event = {
        type: undefined,
        timestamp: 100,
        tags: { error_type: 'workspace_auth_gate_initialization_failure' },
        breadcrumbs: [
          {
            timestamp: 99.998,
            category: 'console',
            message:
              '[Reported error]: vite_preload_error TypeError: Failed to fetch dynamically imported module'
          },
          {
            timestamp: 99.999,
            category: 'sentry.event',
            message: 'TypeError: Failed to fetch dynamically imported module'
          }
        ],
        exception: {
          values: [{ value }]
        }
      } satisfies ErrorEvent

      expect(sentryBeforeSend(event, {})).toMatchObject({
        tags: {
          error_type: 'workspace_auth_gate_initialization_failure',
          error_cause: 'vite_preload_error'
        }
      })
    }
  )

  it('does not attribute an unrelated error inside the follow-on window', () => {
    const event = {
      type: undefined,
      timestamp: 100,
      breadcrumbs: [
        {
          timestamp: 99.998,
          message:
            '[Reported error]: vite_preload_error TypeError: Failed to fetch dynamically imported module'
        }
      ],
      exception: {
        values: [{ value: 'Billing request failed with status 500' }]
      }
    } satisfies ErrorEvent

    expect(sentryBeforeSend(event, {})?.tags?.error_cause).toBeUndefined()
  })

  it.for([
    {
      name: 'the preload error itself',
      event: {
        type: undefined,
        timestamp: 100,
        tags: { error_type: 'vite_preload_error' },
        breadcrumbs: [
          {
            timestamp: 99.999,
            message: '[Reported error]: vite_preload_error TypeError: import'
          }
        ]
      }
    },
    {
      name: 'an error more than five seconds later',
      event: {
        type: undefined,
        timestamp: 106,
        breadcrumbs: [
          {
            timestamp: 100,
            message: '[Reported error]: vite_preload_error TypeError: import'
          }
        ]
      }
    },
    {
      name: 'an event without a client timestamp',
      event: {
        type: undefined,
        breadcrumbs: [
          {
            timestamp: 100,
            message: '[Reported error]: vite_preload_error TypeError: import'
          }
        ]
      }
    }
  ] satisfies Array<{ name: string; event: ErrorEvent }>)(
    'does not attribute $name to a stale chunk',
    ({ event }) => {
      expect(sentryBeforeSend(event, {})).toBe(event)
      expect(sentryBeforeSend(event, {})?.tags?.error_cause).toBeUndefined()
    }
  )
})
