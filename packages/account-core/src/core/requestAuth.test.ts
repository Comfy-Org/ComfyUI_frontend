import { describe, expect, it } from 'vitest'

import { fakeWebSessionUser } from '../testing.js'
import type {
  RequestAuthorization,
  RequestPrincipal,
  RequestTarget
} from './requestAuth.js'
import { COMFY_CLIENT, createRequestAuthorizer } from './requestAuth.js'

const SESSION: RequestPrincipal = {
  kind: 'session',
  session: {
    user: fakeWebSessionUser(),
    csrfToken: 'csrf-1',
    expiresAt: 0,
    absoluteExpiresAt: 0
  }
}
const FIREBASE: RequestPrincipal = {
  kind: 'firebase',
  getIdToken: async () => 'firebase-id-token'
}
const API_KEY: RequestPrincipal = { kind: 'apiKey', apiKey: 'comfyui-key' }

const authorize = createRequestAuthorizer({
  getWorkspaceToken: async (workspaceId) => `jwt-for-${workspaceId}`
})

const COOKIE_READ: RequestAuthorization = {
  headers: {
    'X-Comfy-Client': COMFY_CLIENT,
    'X-Comfy-Workspace-ID': 'ws-1'
  },
  credentials: 'include'
}
const COOKIE_WRITE: RequestAuthorization = {
  headers: { ...COOKIE_READ.headers, 'X-CSRF-Token': 'csrf-1' },
  credentials: 'include'
}
const WORKSPACE_BEARER: RequestAuthorization = {
  headers: { Authorization: 'Bearer jwt-for-ws-1' }
}
const FIREBASE_BEARER: RequestAuthorization = {
  headers: { Authorization: 'Bearer firebase-id-token' }
}
const API_KEY_HEADER: RequestAuthorization = {
  headers: { 'X-API-KEY': 'comfyui-key' }
}

describe('createRequestAuthorizer', () => {
  it.for<{
    target: RequestTarget
    principal: RequestPrincipal
    method: string
    expected: RequestAuthorization
  }>([
    {
      target: 'ingest',
      principal: SESSION,
      method: 'GET',
      expected: COOKIE_READ
    },
    {
      target: 'ingest',
      principal: SESSION,
      method: 'HEAD',
      expected: COOKIE_READ
    },
    {
      target: 'ingest',
      principal: SESSION,
      method: 'OPTIONS',
      expected: COOKIE_READ
    },
    {
      target: 'ingest',
      principal: SESSION,
      method: 'get',
      expected: COOKIE_READ
    },
    {
      target: 'ingest',
      principal: SESSION,
      method: 'POST',
      expected: COOKIE_WRITE
    },
    {
      target: 'ingest',
      principal: SESSION,
      method: 'PUT',
      expected: COOKIE_WRITE
    },
    {
      target: 'ingest',
      principal: SESSION,
      method: 'PATCH',
      expected: COOKIE_WRITE
    },
    {
      target: 'ingest',
      principal: SESSION,
      method: 'DELETE',
      expected: COOKIE_WRITE
    },
    {
      target: 'ingest',
      principal: SESSION,
      method: 'delete',
      expected: COOKIE_WRITE
    },
    {
      target: 'resource',
      principal: SESSION,
      method: 'GET',
      expected: WORKSPACE_BEARER
    },
    {
      target: 'resource',
      principal: SESSION,
      method: 'POST',
      expected: WORKSPACE_BEARER
    },
    {
      target: 'resource',
      principal: SESSION,
      method: 'DELETE',
      expected: WORKSPACE_BEARER
    },
    {
      target: 'ingest',
      principal: FIREBASE,
      method: 'GET',
      expected: FIREBASE_BEARER
    },
    {
      target: 'ingest',
      principal: FIREBASE,
      method: 'POST',
      expected: FIREBASE_BEARER
    },
    {
      target: 'ingest',
      principal: FIREBASE,
      method: 'DELETE',
      expected: FIREBASE_BEARER
    },
    {
      target: 'resource',
      principal: FIREBASE,
      method: 'GET',
      expected: FIREBASE_BEARER
    },
    {
      target: 'resource',
      principal: FIREBASE,
      method: 'POST',
      expected: FIREBASE_BEARER
    },
    {
      target: 'resource',
      principal: FIREBASE,
      method: 'DELETE',
      expected: FIREBASE_BEARER
    },
    {
      target: 'ingest',
      principal: API_KEY,
      method: 'GET',
      expected: API_KEY_HEADER
    },
    {
      target: 'ingest',
      principal: API_KEY,
      method: 'POST',
      expected: API_KEY_HEADER
    },
    {
      target: 'ingest',
      principal: API_KEY,
      method: 'DELETE',
      expected: API_KEY_HEADER
    },
    {
      target: 'resource',
      principal: API_KEY,
      method: 'GET',
      expected: API_KEY_HEADER
    },
    {
      target: 'resource',
      principal: API_KEY,
      method: 'POST',
      expected: API_KEY_HEADER
    },
    {
      target: 'resource',
      principal: API_KEY,
      method: 'DELETE',
      expected: API_KEY_HEADER
    }
  ])(
    '$target $method as $principal.kind',
    async ({ target, principal, method, expected }) => {
      await expect(
        authorize(principal, { target, method, workspaceId: 'ws-1' })
      ).resolves.toEqual(expected)
    }
  )

  it.for<{ target: RequestTarget; expected: RequestAuthorization }>([
    {
      target: 'ingest',
      expected: {
        headers: { 'X-Comfy-Client': COMFY_CLIENT, 'X-CSRF-Token': 'csrf-1' },
        credentials: 'include'
      }
    },
    {
      target: 'resource',
      expected: { headers: { Authorization: 'Bearer jwt-for-undefined' } }
    }
  ])(
    'sends no workspace header to $target for the personal workspace',
    async ({ target, expected }) => {
      await expect(
        authorize(SESSION, { target, method: 'POST' })
      ).resolves.toEqual(expected)
    }
  )

  it('names the SDK package and its version as the client', () => {
    expect(COMFY_CLIENT).toMatch(/^@comfyorg\/account-core\/\d+\.\d+\.\d+/)
  })
})
