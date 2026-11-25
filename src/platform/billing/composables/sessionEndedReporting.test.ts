import { describe, expect, it } from 'vitest'

import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'

import { sessionEndedReporting } from './sessionEndedReporting'

describe('sessionEndedReporting', () => {
  it.for([
    {
      name: 'a legacy-rail 401',
      error: new WorkspaceApiError('authentication required', 401)
    },
    {
      name: 'an SDK-rail NOT_AUTHENTICATED with its 401',
      error: new WorkspaceApiError(
        'NOT_AUTHENTICATED',
        401,
        'NOT_AUTHENTICATED'
      )
    },
    {
      name: 'an SDK-rail NOT_AUTHENTICATED with no response',
      error: new WorkspaceApiError(
        'NOT_AUTHENTICATED',
        undefined,
        'NOT_AUTHENTICATED'
      )
    }
  ])('keeps $name out of Sentry', ({ error }) => {
    expect(sessionEndedReporting(error)).toEqual({ sentryMode: 'never' })
  })

  it.for([
    { name: 'a 403', error: new WorkspaceApiError('Forbidden', 403) },
    {
      name: 'a REQUEST_FAILED',
      error: new WorkspaceApiError('REQUEST_FAILED', 500, 'REQUEST_FAILED')
    },
    { name: 'a plain error', error: new Error('network down') },
    { name: 'a non-error', error: 'NOT_AUTHENTICATED' }
  ])('leaves $name on the default reporting', ({ error }) => {
    expect(sessionEndedReporting(error)).toEqual({})
  })
})
