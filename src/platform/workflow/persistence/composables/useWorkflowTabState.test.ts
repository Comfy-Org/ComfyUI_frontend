import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    clientId: 'test-client-id',
    initialClientId: 'test-client-id'
  }
}))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

async function loadTabState(userId: string | null) {
  const { setStorageIdentity } = await import('../base/storageIO')
  setStorageIdentity(userId)
  const { useWorkflowTabState } = await import('./useWorkflowTabState')
  return useWorkflowTabState()
}

function setCurrentWorkspace(id: string) {
  sessionStorage.setItem(
    'Comfy.Workspace.Current',
    JSON.stringify({ type: 'team', id })
  )
}

describe('useWorkflowTabState', () => {
  beforeEach(() => {
    vi.resetModules()
    sessionStorage.clear()
  })

  describe('activePath', () => {
    it('returns null when no pointer exists', async () => {
      const { getActivePath } = await loadTabState('user-a')

      expect(getActivePath()).toBeNull()
    })

    it('saves and retrieves active path', async () => {
      setCurrentWorkspace('ws-1')
      const { getActivePath, setActivePath } = await loadTabState('user-a')

      setActivePath('workflows/test.json')
      expect(getActivePath()).toBe('workflows/test.json')
    })

    it('writes nothing and reads nothing while identity is unresolved', async () => {
      const { getActivePath, setActivePath } = await loadTabState(null)

      setActivePath('workflows/test.json')

      expect(sessionStorage.length).toBe(0)
      expect(getActivePath()).toBeNull()
    })

    it('ignores pointer from different workspace', async () => {
      setCurrentWorkspace('ws-1')
      const { setActivePath } = await loadTabState('user-a')
      setActivePath('workflows/test.json')

      vi.resetModules()
      setCurrentWorkspace('ws-2')
      const { getActivePath } = await loadTabState('user-a')

      expect(getActivePath()).toBeNull()
    })

    it('ignores pointer written by a different user in the same workspace', async () => {
      setCurrentWorkspace('ws-1')
      const { setActivePath } = await loadTabState('user-a')
      setActivePath('workflows/test.json')

      vi.resetModules()
      const { getActivePath } = await loadTabState('user-b')

      expect(getActivePath()).toBeNull()
    })
  })

  describe('openPaths', () => {
    it('returns null when no pointer exists', async () => {
      const { getOpenPaths } = await loadTabState('user-a')

      expect(getOpenPaths()).toBeNull()
    })

    it('saves and retrieves open paths', async () => {
      setCurrentWorkspace('ws-1')
      const { getOpenPaths, setOpenPaths } = await loadTabState('user-a')

      const paths = ['workflows/a.json', 'workflows/b.json']
      setOpenPaths(paths, 1)

      const result = getOpenPaths()
      expect(result).not.toBeNull()
      expect(result!.paths).toEqual(paths)
      expect(result!.activeIndex).toBe(1)
    })

    it('writes nothing while identity is unresolved', async () => {
      const { getOpenPaths, setOpenPaths } = await loadTabState(null)

      setOpenPaths(['workflows/test.json'], 0)

      expect(sessionStorage.length).toBe(0)
      expect(getOpenPaths()).toBeNull()
    })

    it('ignores pointer from different workspace', async () => {
      setCurrentWorkspace('ws-1')
      const { setOpenPaths } = await loadTabState('user-a')
      setOpenPaths(['workflows/test.json'], 0)

      vi.resetModules()
      setCurrentWorkspace('ws-2')
      const { getOpenPaths } = await loadTabState('user-a')

      expect(getOpenPaths()).toBeNull()
    })

    it('retains paths when staying in same workspace', async () => {
      setCurrentWorkspace('ws-1')
      const { setOpenPaths, getOpenPaths } = await loadTabState('user-a')

      setOpenPaths(['workflows/test.json'], 0)

      const result = getOpenPaths()
      expect(result).not.toBeNull()
      expect(result!.paths).toEqual(['workflows/test.json'])
    })
  })
})
