import type { ErrorEvent } from '@sentry/vue'
import { describe, expect, it } from 'vitest'

import {
  NoWorkspaceAccessError,
  WorkspaceApiError
} from '@/platform/workspace/api/workspaceApiError'

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
})
