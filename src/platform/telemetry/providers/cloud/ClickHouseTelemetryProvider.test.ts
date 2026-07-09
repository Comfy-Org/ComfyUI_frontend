import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AuthClearedMetadata, WorkflowImportMetadata } from '../../types'
import { ClickHouseTelemetryProvider } from './ClickHouseTelemetryProvider'

const mockFetchApi = vi.fn(
  (_path: string, _init: RequestInit): Promise<Response> =>
    Promise.resolve(new Response())
)

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: (path: string, init: RequestInit) => mockFetchApi(path, init)
  }
}))

const ANALYTICS_ENDPOINT = '/internal/cloud_analytics'

function lastPostedEvent() {
  const [, init] = mockFetchApi.mock.lastCall!
  return JSON.parse(init.body as string)
}

describe('ClickHouseTelemetryProvider', () => {
  const provider = new ClickHouseTelemetryProvider()

  afterEach(() => {
    mockFetchApi.mockClear()
  })

  it('posts an auth_state_cleared event with the clear metadata', () => {
    const metadata: AuthClearedMetadata = {
      user_initiated: false,
      previous_user_id: 'user-123',
      oauth_request_in_flight: true,
      visibility_state: 'visible'
    }

    provider.trackAuthCleared(metadata)

    expect(mockFetchApi).toHaveBeenCalledWith(
      ANALYTICS_ENDPOINT,
      expect.objectContaining({ method: 'POST' })
    )
    expect(lastPostedEvent()).toEqual({
      event_name: 'auth_state_cleared',
      event_data: metadata
    })
  })

  it('posts a node_missing event when a workflow opens with missing nodes', () => {
    const metadata: WorkflowImportMetadata = {
      missing_node_count: 2,
      missing_node_types: ['Foo', 'Bar'],
      open_source: 'file_drop'
    }

    provider.trackWorkflowOpened(metadata)

    expect(lastPostedEvent()).toEqual({
      event_name: 'node_missing',
      event_data: {
        missing_class_types: ['Foo', 'Bar'],
        missing_count: 2,
        source: 'file_drop'
      }
    })
  })

  it('does not post when no nodes are missing', () => {
    provider.trackWorkflowImported({
      missing_node_count: 0,
      missing_node_types: []
    })

    expect(mockFetchApi).not.toHaveBeenCalled()
  })

  it('swallows network failures so telemetry never throws into callers', () => {
    mockFetchApi.mockReturnValueOnce(Promise.reject(new Error('offline')))

    expect(() =>
      provider.trackAuthCleared({
        user_initiated: true,
        oauth_request_in_flight: false,
        visibility_state: 'hidden'
      })
    ).not.toThrow()
  })
})
