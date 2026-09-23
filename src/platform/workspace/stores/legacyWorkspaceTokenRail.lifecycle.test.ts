import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'

import type { LegacyWorkspaceTokenRailDeps } from '@/platform/workspace/stores/legacyWorkspaceTokenRail'
import { createLegacyWorkspaceTokenRail } from '@/platform/workspace/stores/legacyWorkspaceTokenRail'
import {
  TOKEN_REFRESH_BUFFER_MS,
  WORKSPACE_STORAGE_KEYS
} from '@/platform/workspace/workspaceConstants'
import type { WorkspaceIdentity } from '@/platform/workspace/workspaceTypes'

const mockEnsureSessionCookie = vi.hoisted(() => vi.fn())
const mockDistributionTypes = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

vi.mock(import('@/platform/workspace/api/workspaceApiUrl'), () => ({
  workspaceApiUrl: (route: string) => `https://api.example.com/api${route}`
}))

vi.mock<unknown>(import('@/platform/auth/session/useSessionCookie'), () => ({
  useSessionCookie: () => ({ ensureSessionCookie: mockEnsureSessionCookie })
}))

const workspace: WorkspaceIdentity = {
  id: 'workspace-123',
  name: 'Test Workspace',
  type: 'team',
  role: 'owner'
}

const expiresInMs = 3600 * 1000
const recoveryCooldownMs = 5000
const retryBackoffTotalMs = 1000 + 2000 + 4000

function tokenResponse(
  overrides: Record<string, unknown> = {},
  workspaceId = workspace.id
) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        token: `token-${workspaceId}`,
        expires_at: new Date(Date.now() + expiresInMs).toISOString(),
        workspace: { id: workspaceId, name: workspace.name, type: 'team' },
        role: 'owner',
        permissions: ['owner:*'],
        ...overrides
      })
  }
}

function failedResponse(status: number) {
  return {
    ok: false,
    status,
    statusText: `HTTP ${status}`,
    text: () => Promise.resolve(JSON.stringify({ message: 'nope' }))
  }
}

function createRail() {
  const identity = { uid: 'user-a' as string | null }
  const deps: LegacyWorkspaceTokenRailDeps = {
    currentWorkspace: shallowRef<WorkspaceIdentity | null>(null),
    isLoading: ref(false),
    error: ref<Error | null>(null),
    currentUserUid: () => identity.uid,
    isCurrentUser: (ownerUid: string) => ownerUid === identity.uid,
    getIdToken: vi.fn(async () => 'firebase-token'),
    hasSignedInUser: vi.fn(() => true),
    activeWorkspaceId: vi.fn(() => null),
    switchWorkspace: vi.fn((workspaceId: string) =>
      rail.switchLegacyWorkspace(workspaceId)
    ),
    endWorkspaceSession: vi.fn(() => {
      rail.clearLegacyContext()
      return false
    }),
    persistWorkspaceIdentity: vi.fn(),
    clearSessionStorage: vi.fn(),
    surfacePermanentAuthError: vi.fn()
  }
  const rail = createLegacyWorkspaceTokenRail(deps)
  return { rail, deps, identity }
}

type SessionKey = 'CURRENT_WORKSPACE' | 'TOKEN' | 'EXPIRES_AT' | 'OWNER_UID'
const sessionKeys: readonly SessionKey[] = [
  'CURRENT_WORKSPACE',
  'TOKEN',
  'EXPIRES_AT',
  'OWNER_UID'
]

function seedSession(
  overrides: Partial<Record<SessionKey, string | null>> = {}
): void {
  const entries: Record<SessionKey, string | null> = {
    CURRENT_WORKSPACE: JSON.stringify(workspace),
    TOKEN: 'token-workspace-123',
    EXPIRES_AT: String(Date.now() + expiresInMs),
    OWNER_UID: 'user-a',
    ...overrides
  }
  for (const key of sessionKeys) {
    const value = entries[key]
    if (value !== null)
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS[key], value)
  }
}

let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  mockDistributionTypes.isCloud = true
  mockEnsureSessionCookie.mockResolvedValue(undefined)
  mockFetch = vi.fn((_url: string, init: { body: string }) => {
    const { workspace_id: workspaceId } = JSON.parse(init.body)
    return Promise.resolve(tokenResponse({}, workspaceId))
  })
  vi.stubGlobal('fetch', mockFetch)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('minting a workspace token', () => {
  it.for([
    {
      failure: 'no signed-in user',
      uid: null,
      idToken: 'firebase-token',
      response: tokenResponse,
      code: 'NOT_AUTHENTICATED'
    },
    {
      failure: 'no identity token',
      uid: 'user-a',
      idToken: undefined,
      response: tokenResponse,
      code: 'NOT_AUTHENTICATED'
    },
    {
      failure: 'a 401',
      uid: 'user-a',
      idToken: 'firebase-token',
      response: () => failedResponse(401),
      code: 'INVALID_FIREBASE_TOKEN'
    },
    {
      failure: 'a 403',
      uid: 'user-a',
      idToken: 'firebase-token',
      response: () => failedResponse(403),
      code: 'ACCESS_DENIED'
    },
    {
      failure: 'a 404',
      uid: 'user-a',
      idToken: 'firebase-token',
      response: () => failedResponse(404),
      code: 'WORKSPACE_NOT_FOUND'
    },
    {
      failure: 'a 500',
      uid: 'user-a',
      idToken: 'firebase-token',
      response: () => failedResponse(500),
      code: 'TOKEN_EXCHANGE_FAILED'
    },
    {
      failure: 'a body that fails the schema',
      uid: 'user-a',
      idToken: 'firebase-token',
      response: () => ({ ok: true, json: () => Promise.resolve({ token: 1 }) }),
      code: 'TOKEN_EXCHANGE_FAILED'
    },
    {
      failure: 'an unparsable expiry',
      uid: 'user-a',
      idToken: 'firebase-token',
      response: () => tokenResponse({ expires_at: 'never' }),
      code: 'TOKEN_EXCHANGE_FAILED'
    }
  ])(
    'fails closed with $code on $failure',
    async ({ uid, idToken, response, code }) => {
      const { rail, deps, identity } = createRail()
      identity.uid = uid
      vi.mocked(deps.getIdToken).mockResolvedValue(idToken)
      mockFetch.mockResolvedValue(response())

      await expect(
        rail.switchLegacyWorkspace('workspace-123')
      ).rejects.toMatchObject({ code })

      expect(rail.workspaceToken.value).toBeNull()
      expect(deps.error.value).toMatchObject({ code })
      expect(deps.persistWorkspaceIdentity).not.toHaveBeenCalled()
    }
  )

  it('discards a mint that lands after the user changes and settles loading', async () => {
    const { rail, deps, identity } = createRail()
    let deliverToken: (value: unknown) => void = () => {}
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        deliverToken = resolve
      })
    )

    const switching = rail.switchLegacyWorkspace('workspace-123')
    await vi.advanceTimersByTimeAsync(1)
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(deps.isLoading.value).toBe(true)
    identity.uid = 'user-b'
    deliverToken(tokenResponse())
    await switching

    expect(rail.workspaceToken.value).toBeNull()
    expect(deps.currentWorkspace.value).toBeNull()
    expect(deps.persistWorkspaceIdentity).not.toHaveBeenCalled()
    expect(deps.error.value).toBeNull()
    expect(deps.isLoading.value).toBe(false)
  })
})

describe('restoring a session', () => {
  it.for([
    { session: 'has no token', overrides: { TOKEN: null } },
    { session: 'belongs to another user', overrides: { OWNER_UID: 'user-b' } },
    { session: 'has expired', overrides: { EXPIRES_AT: '0' } },
    { session: 'has an unparsable expiry', overrides: { EXPIRES_AT: 'soon' } },
    {
      session: 'carries an identity that fails the schema',
      overrides: { CURRENT_WORKSPACE: JSON.stringify({ id: 'workspace-123' }) }
    },
    {
      session: 'carries corrupt identity JSON',
      overrides: { CURRENT_WORKSPACE: '{' }
    }
  ])('does not restore a session that $session', ({ overrides }) => {
    const { rail, deps } = createRail()
    seedSession(overrides)

    expect(rail.initializeFromSession()).toBe(false)

    expect(deps.clearSessionStorage).toHaveBeenCalledOnce()
    expect(deps.currentWorkspace.value).toBeNull()
    expect(rail.hasValidWorkspaceToken()).toBe(false)
  })

  it('restores a valid session and arms its refresh', async () => {
    const { rail, deps } = createRail()
    seedSession()

    expect(rail.initializeFromSession()).toBe(true)

    expect(deps.currentWorkspace.value).toEqual(workspace)
    expect(rail.getWorkspaceToken()).toBe('token-workspace-123')
    await vi.advanceTimersByTimeAsync(expiresInMs - TOKEN_REFRESH_BUFFER_MS)
    expect(deps.switchWorkspace).toHaveBeenCalledExactlyOnceWith(
      'workspace-123'
    )
  })
})

describe('ensureWorkspaceToken', () => {
  it('serves the held token without a mint while it is valid for the target', async () => {
    const { rail } = createRail()
    await rail.switchLegacyWorkspace('workspace-123')

    await expect(rail.ensureWorkspaceToken('workspace-123')).resolves.toBe(
      'token-workspace-123'
    )
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it.for([
    {
      when: 'nobody is signed in',
      uid: null,
      isCloud: true,
      active: null,
      target: 'workspace-123',
      token: null,
      mints: 0
    },
    {
      when: 'there is no target workspace',
      uid: 'user-a',
      isCloud: true,
      active: null,
      target: undefined,
      token: null,
      mints: 0
    },
    {
      when: 'the local active workspace differs',
      uid: 'user-a',
      isCloud: false,
      active: 'workspace-other',
      target: 'workspace-123',
      token: null,
      mints: 0
    },
    {
      when: 'the local active workspace matches',
      uid: 'user-a',
      isCloud: false,
      active: 'workspace-123',
      target: 'workspace-123',
      token: 'token-workspace-123',
      mints: 1
    },
    {
      when: 'cloud ignores the local selection',
      uid: 'user-a',
      isCloud: true,
      active: 'workspace-other',
      target: 'workspace-123',
      token: 'token-workspace-123',
      mints: 1
    }
  ])(
    'resolves $token with $mints mint(s) when $when',
    async ({ uid, isCloud, active, target, token, mints }) => {
      mockDistributionTypes.isCloud = isCloud
      const { rail, deps, identity } = createRail()
      identity.uid = uid
      vi.mocked(deps.activeWorkspaceId).mockReturnValue(active)

      await expect(rail.ensureWorkspaceToken(target)).resolves.toBe(token)
      expect(mockFetch).toHaveBeenCalledTimes(mints)
    }
  )

  it.for([
    { retry: 'immediately', after: 0, mints: 1 },
    {
      retry: 'just inside the cooldown',
      after: recoveryCooldownMs - 1,
      mints: 1
    },
    { retry: 'once the cooldown lapses', after: recoveryCooldownMs, mints: 2 }
  ])(
    'backs off a failed recovery: retrying $retry makes $mints mint(s)',
    async ({ after, mints }) => {
      const { rail } = createRail()
      mockFetch.mockResolvedValue(failedResponse(500))

      await expect(
        rail.ensureWorkspaceToken('workspace-123')
      ).resolves.toBeNull()
      vi.advanceTimersByTime(after)
      await expect(
        rail.ensureWorkspaceToken('workspace-123')
      ).resolves.toBeNull()

      expect(mockFetch).toHaveBeenCalledTimes(mints)
    }
  )

  it('retries at once after a revoked selection has been forgotten', async () => {
    const { rail, deps } = createRail()
    vi.mocked(deps.endWorkspaceSession).mockImplementation(() => {
      rail.clearLegacyContext()
      return true
    })
    mockFetch.mockResolvedValueOnce(failedResponse(403))

    await expect(rail.ensureWorkspaceToken('workspace-123')).resolves.toBeNull()
    await expect(rail.ensureWorkspaceToken('workspace-123')).resolves.toBe(
      'token-workspace-123'
    )

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('fails closed and backs off when the mint lands on a different workspace', async () => {
    const { rail } = createRail()
    mockFetch.mockResolvedValue(tokenResponse({}, 'workspace-123'))

    await expect(rail.ensureWorkspaceToken('workspace-456')).resolves.toBeNull()
    await expect(rail.ensureWorkspaceToken('workspace-456')).resolves.toBeNull()

    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it.for([
    {
      failure: 'a 403',
      idToken: 'firebase-token',
      signedIn: true,
      response: () => failedResponse(403),
      ended: [['workspace-999']],
      surfaced: 1
    },
    {
      failure: 'a 404',
      idToken: 'firebase-token',
      signedIn: true,
      response: () => failedResponse(404),
      ended: [['workspace-999']],
      surfaced: 1
    },
    {
      failure: 'a 401',
      idToken: 'firebase-token',
      signedIn: true,
      response: () => failedResponse(401),
      ended: [[undefined]],
      surfaced: 1
    },
    {
      failure: 'a 500',
      idToken: 'firebase-token',
      signedIn: true,
      response: () => failedResponse(500),
      ended: [],
      surfaced: 0
    },
    {
      failure: 'a missing identity token while signed in',
      idToken: undefined,
      signedIn: true,
      response: tokenResponse,
      ended: [],
      surfaced: 0
    },
    {
      failure: 'a missing identity token after sign-out',
      idToken: undefined,
      signedIn: false,
      response: tokenResponse,
      ended: [[undefined]],
      surfaced: 1
    }
  ])(
    'classifies $failure during recovery',
    async ({ idToken, signedIn, response, ended, surfaced }) => {
      const { rail, deps } = createRail()
      await rail.switchLegacyWorkspace('workspace-123')
      vi.mocked(deps.getIdToken).mockResolvedValue(idToken)
      vi.mocked(deps.hasSignedInUser).mockReturnValue(signedIn)
      mockFetch.mockResolvedValue(response())

      await expect(
        rail.ensureWorkspaceToken('workspace-999')
      ).resolves.toBeNull()

      expect(vi.mocked(deps.endWorkspaceSession).mock.calls).toEqual(ended)
      expect(deps.surfacePermanentAuthError).toHaveBeenCalledTimes(surfaced)
    }
  )

  it('collapses concurrent callers onto the in-flight mint', async () => {
    const { rail } = createRail()
    let deliverToken: (value: unknown) => void = () => {}
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        deliverToken = resolve
      })
    )

    const switching = rail.switchLegacyWorkspace('workspace-123')
    const waiters = Promise.all([
      rail.ensureWorkspaceToken('workspace-123'),
      rail.ensureWorkspaceToken('workspace-123')
    ])
    deliverToken(tokenResponse())
    await switching

    await expect(waiters).resolves.toEqual([
      'token-workspace-123',
      'token-workspace-123'
    ])
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it.for([
    {
      distribution: 'cloud',
      isCloud: true,
      token: 'token-workspace-123',
      current: 'workspace-123',
      mints: 2
    },
    {
      distribution: 'local',
      isCloud: false,
      token: null,
      current: 'workspace-other',
      mints: 1
    }
  ])(
    'after joining a switch to another workspace on $distribution, resolves $token',
    async ({ isCloud, token, current, mints }) => {
      mockDistributionTypes.isCloud = isCloud
      const { rail, deps } = createRail()
      vi.mocked(deps.activeWorkspaceId).mockReturnValue('workspace-123')

      const switching = rail.switchLegacyWorkspace('workspace-other')
      const recovered = rail.ensureWorkspaceToken('workspace-123')
      await switching

      await expect(recovered).resolves.toBe(token)
      expect(deps.currentWorkspace.value?.id).toBe(current)
      expect(mockFetch).toHaveBeenCalledTimes(mints)
    }
  )
})

describe('refreshToken', () => {
  it('is a no-op without a workspace context', async () => {
    const { rail } = createRail()

    await rail.refreshToken()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it.for([
    {
      failure: 'a 403',
      response: () => failedResponse(403),
      fetches: 2,
      ended: [['workspace-123']],
      token: undefined
    },
    {
      failure: 'a 404',
      response: () => failedResponse(404),
      fetches: 2,
      ended: [['workspace-123']],
      token: undefined
    },
    {
      failure: 'a 401',
      response: () => failedResponse(401),
      fetches: 2,
      ended: [[undefined]],
      token: undefined
    }
  ])(
    'settles $failure after $fetches exchange(s)',
    async ({ response, fetches, ended, token }) => {
      const { rail, deps } = createRail()
      await rail.switchLegacyWorkspace('workspace-123')
      mockFetch.mockResolvedValue(response())

      const refreshing = rail.refreshToken()
      await vi.advanceTimersByTimeAsync(retryBackoffTotalMs)
      await refreshing

      expect(mockFetch).toHaveBeenCalledTimes(fetches)
      expect(vi.mocked(deps.endWorkspaceSession).mock.calls).toEqual(ended)
      expect(rail.getWorkspaceToken()).toBe(token)
    }
  )

  it('retries repeated 500s on a doubling backoff, then keeps the held token', async () => {
    const { rail, deps } = createRail()
    await rail.switchLegacyWorkspace('workspace-123')
    mockFetch.mockResolvedValue(failedResponse(500))

    const refreshing = rail.refreshToken()
    await vi.advanceTimersByTimeAsync(999)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(mockFetch).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(1999)
    expect(mockFetch).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(1)
    expect(mockFetch).toHaveBeenCalledTimes(4)
    await vi.advanceTimersByTimeAsync(3999)
    expect(mockFetch).toHaveBeenCalledTimes(4)
    await vi.advanceTimersByTimeAsync(1)
    expect(mockFetch).toHaveBeenCalledTimes(5)
    await refreshing

    expect(deps.endWorkspaceSession).not.toHaveBeenCalled()
    expect(rail.getWorkspaceToken()).toBe('token-workspace-123')
  })

  it('ends the session without retrying when the mint fails before the exchange', async () => {
    const { rail, deps } = createRail()
    await rail.switchLegacyWorkspace('workspace-123')
    mockEnsureSessionCookie.mockRejectedValue(new Error('offline'))

    const refreshing = rail.refreshToken()
    await vi.advanceTimersByTimeAsync(retryBackoffTotalMs)
    await refreshing

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(vi.mocked(deps.endWorkspaceSession).mock.calls).toEqual([[]])
  })

  it.for([
    { held: 'has expired', clockAdvanceMs: expiresInMs + 1, uid: 'user-a' },
    { held: 'belongs to another user', clockAdvanceMs: 0, uid: 'user-b' }
  ])(
    'ends the session once retries are exhausted and the held token $held',
    async ({ clockAdvanceMs, uid }) => {
      const { rail, deps, identity } = createRail()
      await rail.switchLegacyWorkspace('workspace-123')
      mockFetch.mockResolvedValue(failedResponse(500))
      vi.setSystemTime(Date.now() + clockAdvanceMs)
      identity.uid = uid

      const refreshing = rail.refreshToken()
      await vi.advanceTimersByTimeAsync(retryBackoffTotalMs)
      await refreshing

      expect(mockFetch).toHaveBeenCalledTimes(5)
      expect(vi.mocked(deps.endWorkspaceSession).mock.calls).toEqual([[]])
    }
  )

  it('abandons the retry chain once the workspace context has moved on', async () => {
    const { rail, deps } = createRail()
    await rail.switchLegacyWorkspace('workspace-123')
    mockFetch.mockResolvedValueOnce(failedResponse(500))

    const refreshing = rail.refreshToken()
    await vi.advanceTimersByTimeAsync(999)
    rail.clearLegacyContext()
    await vi.advanceTimersByTimeAsync(retryBackoffTotalMs)
    await refreshing

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(deps.currentWorkspace.value).toBeNull()
    expect(deps.endWorkspaceSession).not.toHaveBeenCalled()
  })

  it('caps scheduled refresh retries and ends the session at expiry', async () => {
    const { rail, deps } = createRail()
    await rail.switchLegacyWorkspace('workspace-123')
    mockFetch.mockResolvedValue(failedResponse(500))

    const refreshing = rail.refreshToken()
    await vi.advanceTimersByTimeAsync(60_000)
    await refreshing

    expect(mockFetch).toHaveBeenCalledTimes(17)
    expect(rail.getWorkspaceToken()).toBe('token-workspace-123')
    expect(deps.error.value).toBeNull()
    expect(deps.endWorkspaceSession).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(expiresInMs - 60_000)

    expect(mockFetch).toHaveBeenCalledTimes(17)
    expect(vi.mocked(deps.endWorkspaceSession).mock.calls).toEqual([[]])
  })
})
