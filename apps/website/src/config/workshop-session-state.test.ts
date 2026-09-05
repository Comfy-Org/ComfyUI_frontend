// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopSession } from './workshop-session'

const h = vi.hoisted(() => ({
  initialFlag: true,
  flag: undefined as { value: boolean } | undefined,
  emitUser: undefined as ((user: unknown) => void) | undefined,
  onUserChanged: vi.fn(),
  stopUserChanged: vi.fn(),
  ensureFresh: vi.fn(),
  remint: vi.fn(),
  clear: vi.fn()
}))

vi.mock('../scripts/posthog', async () => {
  const { ref } = await import('vue')
  const flag = ref(h.initialFlag)
  h.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock('./workshop-firebase', () => ({
  onWorkshopUserChanged: (cb: (user: unknown) => void) => {
    h.emitUser = cb
    h.onUserChanged()
    return h.stopUserChanged
  },
  signOutWorkshop: vi.fn()
}))

vi.mock('./workshop-session', () => ({
  ensureFreshWorkshopSession: h.ensureFresh,
  remintWorkshopSession: h.remint,
  clearWorkshopSession: h.clear
}))

const okSession: WorkshopSession = {
  token: 'jwt',
  permissions: ['workspace:read'],
  expiresAt: Date.now() + 3_600_000,
  uid: 'user-1',
  workspace: { id: 'ws', name: 'Personal', type: 'personal' },
  role: 'owner'
}

async function importFresh() {
  vi.resetModules()
  const mod = await import('./workshop-session-state')
  const session = mod.useWorkshopSession()
  if (h.initialFlag) {
    await vi.waitFor(() => expect(h.onUserChanged).toHaveBeenCalledOnce())
  }
  return session
}

beforeEach(() => {
  h.emitUser = undefined
  h.initialFlag = true
  h.onUserChanged.mockClear()
  h.stopUserChanged.mockClear()
  h.ensureFresh.mockReset()
  h.remint.mockReset()
  h.clear.mockReset()
})

describe('useWorkshopSession', () => {
  it('does not import Firebase until the auth flag turns on', async () => {
    h.initialFlag = false
    await importFresh()

    expect(h.onUserChanged).not.toHaveBeenCalled()
    h.flag!.value = true
    await vi.waitFor(() => expect(h.onUserChanged).toHaveBeenCalledOnce())
  })

  it('publishes the session when a restored user mints successfully', async () => {
    h.ensureFresh.mockResolvedValue({ status: 'ok', session: okSession })
    const s = await importFresh()

    h.emitUser?.({ uid: 'user-1' })
    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))
    expect(s.signedIn.value).toBe(true)
  })

  it('drops the stale session when a refresh fails, so no stale token is served', async () => {
    h.ensureFresh
      .mockResolvedValueOnce({ status: 'ok', session: okSession })
      .mockResolvedValueOnce({ status: 'error', reason: 'http' })
    const s = await importFresh()
    h.emitUser?.({ uid: 'user-1' })
    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))

    const result = await s.ensureFresh()

    expect(result?.status).toBe('error')
    expect(
      s.session.value,
      'a failed refresh must clear the session, or the run path fires with a stale token'
    ).toBeUndefined()
  })

  it('mints directly from a popup user before the listener publishes it', async () => {
    h.ensureFresh.mockResolvedValue({ status: 'ok', session: okSession })
    const s = await importFresh()
    const popupUser = { uid: 'user-1' }

    const result = await s.ensureFresh(popupUser as never)

    expect(h.ensureFresh).toHaveBeenCalledWith(popupUser)
    expect(result?.status).toBe('ok')
    expect(s.session.value).toEqual(okSession)
  })

  it('clears the session on sign-out', async () => {
    h.ensureFresh.mockResolvedValue({ status: 'ok', session: okSession })
    const s = await importFresh()
    h.emitUser?.({ uid: 'user-1' })
    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))

    h.emitUser?.(null)
    await vi.waitFor(() => expect(s.session.value).toBeUndefined())
    expect(h.clear).toHaveBeenCalled()
  })
})
