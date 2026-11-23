import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAxiosInstance } = vi.hoisted(() => ({
  mockAxiosInstance: {
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
  }
}))

vi.mock<unknown>(import('axios'), () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
    isAxiosError: vi.fn(() => false)
  }
}))

vi.mock(import('@comfyorg/api-client/webSessionFetch'), () => ({
  webSessionRequests: () => undefined,
  webSessionSend: async () => undefined
}))

import {
  requestAuth,
  setIngestApiAuth
} from '@/platform/remote/ingest/ingestApi'
import type { IngestApiAuth } from '@/platform/remote/ingest/ingestApi'
import {
  PROJECT_ID_HEADER,
  setSelectedProjectId
} from '@/platform/remote/ingest/projectRequestContext'

const AUTH_HEADER = { Authorization: 'Bearer test-token' } as const

const auth = {
  getWorkspaceAuthHeader: vi.fn<IngestApiAuth['getWorkspaceAuthHeader']>(),
  getFirebaseAuthHeader: vi.fn<IngestApiAuth['getFirebaseAuthHeader']>(),
  attachRetryInterceptor: vi.fn()
}

describe('requestAuth project header', () => {
  beforeEach(() => {
    setSelectedProjectId(null)
    setIngestApiAuth(auth)
    vi.mocked(auth.getWorkspaceAuthHeader).mockResolvedValue(AUTH_HEADER)
  })

  it('omits X-Comfy-Project-ID when no project is selected', async () => {
    const result = await requestAuth()
    expect(result.headers).toEqual(AUTH_HEADER)
  })

  it('sends X-Comfy-Project-ID with the selected project', async () => {
    setSelectedProjectId('proj-studio')
    const result = await requestAuth()
    expect(result.headers).toEqual({
      ...AUTH_HEADER,
      [PROJECT_ID_HEADER]: 'proj-studio'
    })
  })
})
