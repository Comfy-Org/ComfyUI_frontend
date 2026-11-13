import { beforeEach, expect, it, vi } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'
import { useAuthStore } from '@/stores/authStore'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { AnalyticsConsentRuntimePorts } from '@comfyorg/api-client/analyticsConsentRuntime'
import { installCloudHomepageConsentHost } from './cloudHomepageConsentHost'

vi.mock(import('firebase/auth'))

const mocks = vi.hoisted(() => ({
  bind: vi.fn(),
  scope: vi.fn(),
  token: vi.fn(),
  dispose: vi.fn(),
  providerChanged: () => {},
  stopProvider: vi.fn()
}))
vi.mock(import('@comfyorg/api-client/analyticsConsentRuntime'), () => ({
  bindAnalyticsConsentRuntime: mocks.bind
}))
vi.mock(import('@comfyorg/api-client/webSessionFetch'), () => ({
  webSessionRequests: () => requests,
  subscribeWebSessionRequests: (listener: () => void) => {
    mocks.providerChanged = listener
    return mocks.stopProvider
  }
}))
const requests = {
  scope: mocks.scope,
  workspaceToken: mocks.token,
  refreshSession: async () => {},
  workspaceId: () => 'workspace',
  send: async () => new Response(null, { status: 204 }),
  remintWorkspaceToken: mocks.token,
  authorizeResource: async () => ({})
}
const configuration = {
  enabled: true,
  policyVersion: 'fixture',
  noticeDigest: 'notice'
}
const credential = {
  uid: 'actor',
  token: 'fixture.jwt.token',
  expiresAt: Date.now() + 60_000,
  workspace: { id: 'workspace', name: 'Fixture', type: 'team' },
  role: 'owner',
  permissions: []
}
const scope = {
  epoch: 1,
  workspaceId: 'workspace',
  session: { user: { id: 'actor' } }
}

beforeEach(() => {
  useAuthStore().currentUser = fromPartial<
    NonNullable<ReturnType<typeof useAuthStore>['currentUser']>
  >({ uid: 'actor' })
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace' })
  useCloudWebSessionStore().state = { phase: 'idle' }
  mocks.scope.mockResolvedValue(scope)
  mocks.token.mockResolvedValue({ status: 'ok', credential })
  mocks.bind.mockReturnValue({ dispose: mocks.dispose })
})

function start() {
  const stop = installCloudHomepageConsentHost({
    configuration,
    subscribe: vi.fn(),
    setEligible: vi.fn()
  })
  const ports: AnalyticsConsentRuntimePorts = mocks.bind.mock.calls[0][1]
  const listener = vi.fn()
  const unsubscribe = ports.onSession(listener)
  return { stop, listener, unsubscribe }
}

it('default bootstrap creates no watchers, auth initialization or writes', () => {
  installCloudHomepageConsentHost()()
  expect(mocks.bind).not.toHaveBeenCalled()
  expect(mocks.token).not.toHaveBeenCalled()
  expect(useCloudWebSessionStore().start).not.toHaveBeenCalled()
})

it('forwards only the current authenticated workspace credential', async () => {
  const state = start()
  await vi.waitFor(() =>
    expect(state.listener).toHaveBeenLastCalledWith(credential)
  )
  state.unsubscribe()
  state.stop()
  expect(mocks.dispose).toHaveBeenCalledOnce()
  expect(mocks.stopProvider).toHaveBeenCalledOnce()
})

it('account change during mint cannot publish the old credential', async () => {
  let resolve!: (value: unknown) => void
  mocks.token.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const state = start()
  await vi.waitFor(() => expect(mocks.token).toHaveBeenCalledOnce())
  useAuthStore().currentUser = null
  resolve({ status: 'ok', credential })
  await Promise.resolve()
  await Promise.resolve()
  expect(state.listener).toHaveBeenLastCalledWith(undefined)
  state.unsubscribe()
  state.stop()
})

it('requires a resolved workspace matching the request scope', async () => {
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: '' })
  const missing = start()
  expect(mocks.token).not.toHaveBeenCalled()
  missing.unsubscribe()
  missing.stop()
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace' })
  mocks.scope.mockResolvedValue({ ...scope, workspaceId: 'other' })
  const mismatch = start()
  await Promise.resolve()
  await Promise.resolve()
  expect(mocks.token).not.toHaveBeenCalled()
  mismatch.unsubscribe()
  mismatch.stop()
})

it('session-state or token refresh invalidates and remints the stable account scope', async () => {
  const state = start()
  await vi.waitFor(() =>
    expect(state.listener).toHaveBeenLastCalledWith(credential)
  )
  useCloudWebSessionStore().state = { phase: 'reading', failures: 0 }
  expect(state.listener).toHaveBeenLastCalledWith(undefined)
  await vi.waitFor(() => expect(mocks.token).toHaveBeenCalledTimes(2))
  useAuthStore().tokenRefreshTrigger++
  expect(state.listener).toHaveBeenLastCalledWith(undefined)
  await vi.waitFor(() => expect(mocks.token).toHaveBeenCalledTimes(3))
  mocks.providerChanged()
  expect(state.listener).toHaveBeenLastCalledWith(undefined)
  await vi.waitFor(() => expect(mocks.token).toHaveBeenCalledTimes(4))
  state.unsubscribe()
  state.stop()
})

it.for(['identity', 'workspace', 'epoch', 'failure'] as const)(
  'rejects mismatched or failed %s resolution',
  async (kind) => {
    if (kind === 'identity')
      mocks.token.mockResolvedValue({
        status: 'ok',
        credential: { ...credential, uid: 'other' }
      })
    if (kind === 'workspace')
      mocks.token.mockResolvedValue({
        status: 'ok',
        credential: { ...credential, workspace: { id: 'other' } }
      })
    if (kind === 'epoch')
      mocks.scope
        .mockResolvedValueOnce(scope)
        .mockResolvedValue({ ...scope, epoch: 2 })
    if (kind === 'failure')
      mocks.token.mockRejectedValue(new Error('fixture failure'))
    const state = start()
    await vi.waitFor(() => expect(mocks.token).toHaveBeenCalledOnce())
    await Promise.resolve()
    await Promise.resolve()
    expect(
      state.listener.mock.calls.every(([value]) => value === undefined)
    ).toBe(true)
    state.unsubscribe()
    state.stop()
  }
)
