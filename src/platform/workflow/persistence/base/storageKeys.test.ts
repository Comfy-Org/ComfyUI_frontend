import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDistributionTypes = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

describe('storageKeys', () => {
  beforeEach(() => {
    mockDistributionTypes.isCloud = true
    vi.resetModules()
  })

  describe('readWorkspaceId', () => {
    it('returns null when no Cloud workspace is set', async () => {
      const { readWorkspaceId } = await import('./storageKeys')
      expect(readWorkspaceId()).toBeNull()
    })

    it('returns personal for personal workspace type', async () => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'personal', id: null })
      )
      const { readWorkspaceId } = await import('./storageKeys')
      expect(readWorkspaceId()).toBe('personal')
    })

    it('returns workspace ID for team workspace', async () => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'team', id: 'ws-abc-123' })
      )
      const { readWorkspaceId } = await import('./storageKeys')
      expect(readWorkspaceId()).toBe('ws-abc-123')
    })

    it('keeps local workflow storage in the personal namespace', async () => {
      mockDistributionTypes.isCloud = false
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'team', id: 'ws-abc-123' })
      )
      const { readWorkspaceId } = await import('./storageKeys')

      expect(readWorkspaceId()).toBe('personal')
    })

    it('returns null when JSON parsing fails', async () => {
      sessionStorage.setItem('Comfy.Workspace.Current', 'invalid-json')
      const { readWorkspaceId } = await import('./storageKeys')
      expect(readWorkspaceId()).toBeNull()
    })

    it('returns null when parsed workspace data is not an object', async () => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify('workspace-id')
      )
      const { readWorkspaceId } = await import('./storageKeys')
      expect(readWorkspaceId()).toBeNull()
    })

    it('returns null when a team workspace has no id', async () => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'team', id: '' })
      )
      const { readWorkspaceId } = await import('./storageKeys')
      expect(readWorkspaceId()).toBeNull()
    })

    it('reads fresh value on each call (not cached)', async () => {
      const { readWorkspaceId } = await import('./storageKeys')

      // Initially no workspace set
      expect(readWorkspaceId()).toBeNull()

      // Set workspace after import
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'team', id: 'ws-new' })
      )

      // Should read the new value (not cached 'personal')
      expect(readWorkspaceId()).toBe('ws-new')

      // Change workspace again
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'team', id: 'ws-another' })
      )

      expect(readWorkspaceId()).toBe('ws-another')
    })
  })

  describe('StorageKeys', () => {
    it('separates Cloud users in one workspace and defers unresolved identity', async () => {
      const { resolveStorageScope } = await import('./storageKeys')

      expect(resolveStorageScope('user-a', 'workspace-1')).toBe(
        'user-a:workspace-1'
      )
      expect(resolveStorageScope('user-b', 'workspace-1')).toBe(
        'user-b:workspace-1'
      )
      expect(resolveStorageScope(null, 'workspace-1')).toBeNull()
      expect(resolveStorageScope('user-a', null)).toBeNull()
    })

    it('uses the personal scope outside Cloud', async () => {
      mockDistributionTypes.isCloud = false
      const { resolveStorageScope } = await import('./storageKeys')

      expect(resolveStorageScope(null, null)).toBe('personal')
    })

    it('generates draftIndex key with workspace scope', async () => {
      const { StorageKeys } = await import('./storageKeys')
      const { unsafeStorageScope } = await import('../testUtils/storageScope')

      expect(StorageKeys.draftIndex(unsafeStorageScope('ws-123'))).toBe(
        'Comfy.Workflow.DraftIndex.v2:ws-123'
      )
    })

    it('generates draftPayload key with hash', async () => {
      const { StorageKeys } = await import('./storageKeys')
      const { unsafeStorageScope } = await import('../testUtils/storageScope')
      const key = StorageKeys.draftPayload(
        'workflows/test.json',
        unsafeStorageScope('ws-1')
      )

      expect(key).toMatch(/^Comfy\.Workflow\.Draft\.v2:ws-1:[0-9a-f]{8}$/)
    })

    it('generates consistent draftKey from path', async () => {
      const { StorageKeys } = await import('./storageKeys')
      const key1 = StorageKeys.draftKey('workflows/test.json')
      const key2 = StorageKeys.draftKey('workflows/test.json')

      expect(key1).toBe(key2)
      expect(key1).toMatch(/^[0-9a-f]{8}$/)
    })

    it('generates activePath key with clientId', async () => {
      const { StorageKeys } = await import('./storageKeys')
      expect(StorageKeys.activePath('client-abc')).toBe(
        'Comfy.Workflow.ActivePath:client-abc'
      )
    })

    it('generates openPaths key with clientId', async () => {
      const { StorageKeys } = await import('./storageKeys')
      expect(StorageKeys.openPaths('client-abc')).toBe(
        'Comfy.Workflow.OpenPaths:client-abc'
      )
    })

    it('scopes Agent persistence keys to the workspace', async () => {
      const { StorageKeys } = await import('./storageKeys')
      const { unsafeStorageScope } = await import('../testUtils/storageScope')
      const scope = unsafeStorageScope('ws-123')

      expect(StorageKeys.agentThread(scope)).toBe('Comfy.Agent.ThreadId:ws-123')
      expect(StorageKeys.agentWorkflowTabBindings(scope)).toBe(
        'Comfy.Agent.WorkflowTabBindings:ws-123'
      )
      expect(StorageKeys.agentChatTitles(scope)).toBe(
        'Comfy.Agent.ChatTitles:ws-123'
      )
      expect(StorageKeys.agentDeletedThreads(scope)).toBe(
        'Comfy.Agent.DeletedThreads:ws-123'
      )
    })

    it('exposes prefix patterns for cleanup', async () => {
      const { StorageKeys } = await import('./storageKeys')

      expect(StorageKeys.prefixes.draftIndex).toBe(
        'Comfy.Workflow.DraftIndex.v2:'
      )
      expect(StorageKeys.prefixes.draftPayload).toBe('Comfy.Workflow.Draft.v2:')
      expect(StorageKeys.prefixes.activePath).toBe('Comfy.Workflow.ActivePath:')
      expect(StorageKeys.prefixes.openPaths).toBe('Comfy.Workflow.OpenPaths:')
    })
  })
})
