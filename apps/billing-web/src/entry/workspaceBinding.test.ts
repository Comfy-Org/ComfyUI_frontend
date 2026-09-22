const STORAGE_KEY = 'comfy.billing-web.workspace.v1'

/** A fresh module instance sees today's `window.location` and storage, matching a real page load. */
async function freshBinding() {
  vi.resetModules()
  return import('@/entry/workspaceBinding')
}

beforeEach(() => {
  sessionStorage.clear()
  history.pushState(null, '', '/')
})

describe('boundWorkspaceId', () => {
  it('is unset when the arriving URL names no workspace', async () => {
    const { boundWorkspaceId } = await freshBinding()

    expect(boundWorkspaceId()).toBeUndefined()
  })

  it('reads the workspace an entry link names on arrival', async () => {
    history.pushState(
      null,
      '',
      '/v1/subscription?product=comfyui&return_to=comfyui_workspace&workspace=ws-team'
    )

    const { boundWorkspaceId } = await freshBinding()

    expect(boundWorkspaceId()).toBe('ws-team')
  })

  it('falls back to a binding a previous page in this tab stored', async () => {
    sessionStorage.setItem(STORAGE_KEY, 'ws-team')

    const { boundWorkspaceId } = await freshBinding()

    expect(boundWorkspaceId()).toBe('ws-team')
  })

  it('prefers the arriving URL over a stale stored binding', async () => {
    sessionStorage.setItem(STORAGE_KEY, 'ws-old')
    history.pushState(
      null,
      '',
      '/v1/subscription?product=comfyui&return_to=comfyui_workspace&workspace=ws-new'
    )

    const { boundWorkspaceId } = await freshBinding()

    expect(boundWorkspaceId()).toBe('ws-new')
  })
})

describe('bindEntryWorkspace', () => {
  it('binds an unbound tab and reports the change', async () => {
    const { bindEntryWorkspace, boundWorkspaceId } = await freshBinding()

    expect(bindEntryWorkspace('ws-team')).toBe(true)
    expect(boundWorkspaceId()).toBe('ws-team')
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('ws-team')
  })

  it('rebinds to a later link naming a different workspace', async () => {
    const { bindEntryWorkspace, boundWorkspaceId } = await freshBinding()
    bindEntryWorkspace('ws-team')

    expect(bindEntryWorkspace('ws-other')).toBe(true)
    expect(boundWorkspaceId()).toBe('ws-other')
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('ws-other')
  })

  it('reports no change when a link repeats the workspace already bound', async () => {
    const { bindEntryWorkspace } = await freshBinding()
    bindEntryWorkspace('ws-team')

    expect(bindEntryWorkspace('ws-team')).toBe(false)
  })

  it('still binds for the tab when storage throws outright', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('storage disabled')
      },
      setItem: () => {
        throw new Error('storage disabled')
      },
      removeItem: () => {
        throw new Error('storage disabled')
      }
    })
    const { bindEntryWorkspace, boundWorkspaceId } = await freshBinding()

    expect(bindEntryWorkspace('ws-team')).toBe(true)
    expect(boundWorkspaceId()).toBe('ws-team')
  })
})
