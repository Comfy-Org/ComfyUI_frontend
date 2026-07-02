import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockApi = vi.hoisted(() => ({
  api: {
    clientId: 'test-client-id' as string | null,
    initialClientId: 'test-client-id' as string | null
  }
}))

vi.mock('@/scripts/api', () => ({
  api: mockApi.api
}))

describe('useWorkflowTabState', () => {
  beforeEach(() => {
    vi.resetModules()
    mockApi.api.clientId = 'test-client-id'
    mockApi.api.initialClientId = 'test-client-id'
    sessionStorage.clear()
  })

  describe('activePath', () => {
    it('returns null when no pointer exists', async () => {
      const { useWorkflowTabState } = await import('./useWorkflowTabState')
      const { getActivePath } = useWorkflowTabState()

      expect(getActivePath()).toBeNull()
    })

    it('saves and retrieves active path', async () => {
      const { useWorkflowTabState } = await import('./useWorkflowTabState')
      const { getActivePath, setActivePath } = useWorkflowTabState()

      setActivePath('workflows/test.json')
      expect(getActivePath()).toBe('workflows/test.json')
    })

    it('falls back to initial client ID before client ID is set', async () => {
      mockApi.api.clientId = null
      mockApi.api.initialClientId = 'initial-client-id'
      const { useWorkflowTabState } = await import('./useWorkflowTabState')
      const { getActivePath, setActivePath } = useWorkflowTabState()

      setActivePath('workflows/from-initial.json')

      expect(getActivePath()).toBe('workflows/from-initial.json')
    })

    it('does not read or write active path without any client ID', async () => {
      mockApi.api.clientId = null
      mockApi.api.initialClientId = null
      const { useWorkflowTabState } = await import('./useWorkflowTabState')
      const { getActivePath, setActivePath } = useWorkflowTabState()

      setActivePath('workflows/ignored.json')

      expect(getActivePath()).toBeNull()
      expect(sessionStorage.length).toBe(0)
    })

    it('ignores pointer from different workspace', async () => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'team', id: 'ws-1' })
      )
      const { useWorkflowTabState } = await import('./useWorkflowTabState')
      const { setActivePath } = useWorkflowTabState()
      setActivePath('workflows/test.json')

      vi.resetModules()
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'team', id: 'ws-2' })
      )

      const { useWorkflowTabState: useWorkflowTabState2 } =
        await import('./useWorkflowTabState')
      const { getActivePath } = useWorkflowTabState2()

      expect(getActivePath()).toBeNull()
    })
  })

  describe('openPaths', () => {
    it('returns null when no pointer exists', async () => {
      const { useWorkflowTabState } = await import('./useWorkflowTabState')
      const { getOpenPaths } = useWorkflowTabState()

      expect(getOpenPaths()).toBeNull()
    })

    it('saves and retrieves open paths', async () => {
      const { useWorkflowTabState } = await import('./useWorkflowTabState')
      const { getOpenPaths, setOpenPaths } = useWorkflowTabState()

      const paths = ['workflows/a.json', 'workflows/b.json']
      setOpenPaths(paths, 1)

      const result = getOpenPaths()
      expect(result).not.toBeNull()
      expect(result!.paths).toEqual(paths)
      expect(result!.activeIndex).toBe(1)
    })

    it('does not read or write open paths without any client ID', async () => {
      mockApi.api.clientId = null
      mockApi.api.initialClientId = null
      const { useWorkflowTabState } = await import('./useWorkflowTabState')
      const { getOpenPaths, setOpenPaths } = useWorkflowTabState()

      setOpenPaths(['workflows/ignored.json'], 0)

      expect(getOpenPaths()).toBeNull()
      expect(sessionStorage.length).toBe(0)
    })

    it('ignores pointer from different workspace', async () => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'team', id: 'ws-1' })
      )
      const { useWorkflowTabState } = await import('./useWorkflowTabState')
      const { setOpenPaths } = useWorkflowTabState()
      setOpenPaths(['workflows/test.json'], 0)

      vi.resetModules()
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'team', id: 'ws-2' })
      )

      const { useWorkflowTabState: useWorkflowTabState2 } =
        await import('./useWorkflowTabState')
      const { getOpenPaths } = useWorkflowTabState2()

      expect(getOpenPaths()).toBeNull()
    })

    it('retains paths when staying in same workspace', async () => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'team', id: 'ws-1' })
      )
      const { useWorkflowTabState } = await import('./useWorkflowTabState')
      const { setOpenPaths, getOpenPaths } = useWorkflowTabState()

      setOpenPaths(['workflows/test.json'], 0)

      // Simulate re-reading (same workspace, same clientId)
      const result = getOpenPaths()
      expect(result).not.toBeNull()
      expect(result!.paths).toEqual(['workflows/test.json'])
    })
  })
})
