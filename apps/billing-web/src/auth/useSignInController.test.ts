import type { AccountUser } from '@comfyorg/account-core/session'

/**
 * The identity is built from the freshly reset module graph on every
 * `freshController`, because the session client only accepts an identity
 * branded by the very instance of the package it was itself loaded with.
 */
const h = vi.hoisted(() => ({
  identity: undefined as unknown,
  deliver: undefined as ((user: AccountUser | null) => void) | undefined
}))

vi.mock<unknown>(import('@/config/firebase'), () => ({
  get billingWebIdentity() {
    return h.identity
  }
}))

const WORKSPACE_STORAGE_KEY = 'comfy.billing-web.workspace.v1'

function signedInUser(): AccountUser {
  return { uid: 'uid-1', getIdToken: vi.fn(async () => 'id-token') }
}

/** Mints whatever workspace the request body names, so the assertion reads the body, not a fixed reply. */
function mintedFetchEchoingWorkspace() {
  return vi.fn<typeof fetch>(async (_url, init) => {
    const body: unknown = JSON.parse((init?.body as string | undefined) ?? '{}')
    const workspaceId =
      typeof body === 'object' &&
      body !== null &&
      'workspace_id' in body &&
      typeof body.workspace_id === 'string'
        ? body.workspace_id
        : 'ws-1'
    return new Response(
      JSON.stringify({
        token: 'jwt-1',
        permissions: ['workspace:read'],
        expires_at: new Date(Date.now() + 90 * 60_000).toISOString(),
        workspace: { id: workspaceId, name: workspaceId, type: 'team' },
        role: 'owner'
      }),
      { status: 200 }
    )
  })
}

async function freshController() {
  vi.resetModules()
  const { createTestIdentity } = await import('@comfyorg/account-core/testing')
  h.identity = createTestIdentity<AccountUser>({
    onUserChanged: (callback) => {
      h.deliver = callback
      return () => undefined
    }
  })
  const { useSignInController } = await import('@/auth/useSignInController')
  const { bindEntryWorkspace } = await import('@/entry/workspaceBinding')
  return {
    controller: useSignInController(() => undefined),
    bindEntryWorkspace
  }
}

beforeEach(() => {
  sessionStorage.clear()
  h.identity = undefined
  h.deliver = undefined
})

describe('mint workspace targeting', () => {
  it('mints for the workspace bound while signed out, not the one the client constructed for', async () => {
    // The tab constructs its client bound to workspace A (a previous entry
    // link, or nothing at all).
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, 'ws-a')
    const mint = mintedFetchEchoingWorkspace()
    vi.stubGlobal('fetch', mint)
    const { controller, bindEntryWorkspace } = await freshController()

    // A later entry link rebinds the tab to B before anybody has signed in.
    bindEntryWorkspace('ws-b')
    h.deliver?.(signedInUser())

    await vi.waitFor(() => expect(controller.state.value.step).toBe('signedIn'))
    expect(mint).toHaveBeenCalledOnce()
    const [, init] = mint.mock.calls[0]
    expect(JSON.parse((init as RequestInit).body as string)).toStrictEqual({
      workspace_id: 'ws-b'
    })
  })
})
