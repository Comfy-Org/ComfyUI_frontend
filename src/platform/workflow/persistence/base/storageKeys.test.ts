import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDistributionTypes = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

const { getWorkspaceId, readWorkspaceId, resolveStorageScope, StorageKeys } =
  await import('./storageKeys')

function setCurrentWorkspace(workspace: unknown) {
  sessionStorage.setItem(
    'Comfy.Workspace.Current',
    typeof workspace === 'string' ? workspace : JSON.stringify(workspace)
  )
}

describe('storageKeys', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockDistributionTypes.isCloud = true
  })

  describe('getWorkspaceId', () => {
    it('returns personal when no workspace is set', () => {
      expect(getWorkspaceId()).toBe('personal')
    })

    it('returns personal for personal workspace type', () => {
      setCurrentWorkspace({ type: 'personal', id: null })
      expect(getWorkspaceId()).toBe('personal')
    })

    it('returns workspace ID for team workspace', () => {
      setCurrentWorkspace({ type: 'team', id: 'ws-abc-123' })
      expect(getWorkspaceId()).toBe('ws-abc-123')
    })

    it('keeps local workflow storage in the personal namespace', () => {
      mockDistributionTypes.isCloud = false
      setCurrentWorkspace({ type: 'team', id: 'ws-abc-123' })

      expect(getWorkspaceId()).toBe('personal')
    })

    it('returns personal when JSON parsing fails', () => {
      setCurrentWorkspace('invalid-json')
      expect(getWorkspaceId()).toBe('personal')
    })

    it('returns personal when workspace has no id', () => {
      setCurrentWorkspace({ type: 'team', id: '' })
      expect(getWorkspaceId()).toBe('personal')
    })

    it('reads fresh value on each call (not cached)', () => {
      expect(getWorkspaceId()).toBe('personal')

      setCurrentWorkspace({ type: 'team', id: 'ws-new' })
      expect(getWorkspaceId()).toBe('ws-new')

      setCurrentWorkspace({ type: 'team', id: 'ws-another' })
      expect(getWorkspaceId()).toBe('ws-another')
    })
  })

  describe('readWorkspaceId', () => {
    it('returns null in cloud until a workspace is stored', () => {
      expect(readWorkspaceId()).toBeNull()
    })

    it('returns null in cloud when the stored workspace is unreadable', () => {
      setCurrentWorkspace('invalid-json')
      expect(readWorkspaceId()).toBeNull()
    })

    it('returns the team workspace id in cloud', () => {
      setCurrentWorkspace({ type: 'team', id: 'workspace-a' })
      expect(readWorkspaceId()).toBe('workspace-a')
    })

    it('returns null in cloud when the stored workspace has no type or id', () => {
      setCurrentWorkspace({})
      expect(readWorkspaceId()).toBeNull()
    })

    it('returns null in cloud when the team workspace id is empty', () => {
      setCurrentWorkspace({ type: 'team', id: '' })
      expect(readWorkspaceId()).toBeNull()
    })

    it('returns personal for the personal workspace type', () => {
      setCurrentWorkspace({ type: 'personal', id: null })
      expect(readWorkspaceId()).toBe('personal')
    })

    it('returns personal outside cloud without reading sessionStorage', () => {
      mockDistributionTypes.isCloud = false
      setCurrentWorkspace({ type: 'team', id: 'workspace-a' })
      expect(readWorkspaceId()).toBe('personal')
    })
  })

  describe('resolveStorageScope', () => {
    it('combines user and workspace in cloud', () => {
      expect(resolveStorageScope('user-a', 'ws-1')).toBe('user-a:ws-1')
    })

    it('returns null in cloud until the user is resolved', () => {
      expect(resolveStorageScope(null, 'ws-1')).toBeNull()
    })

    it('returns null in cloud until the workspace is resolved', () => {
      expect(resolveStorageScope('user-a', null)).toBeNull()
    })

    it('ignores identity outside cloud', () => {
      mockDistributionTypes.isCloud = false
      expect(resolveStorageScope(null, 'ws-1')).toBe('personal')
      expect(resolveStorageScope('user-a', 'ws-1')).toBe('personal')
    })
  })

  describe('StorageKeys', () => {
    it('generates draftIndex key with workspace scope', () => {
      expect(StorageKeys.draftIndex('ws-123')).toBe(
        'Comfy.Workflow.DraftIndex.v2:ws-123'
      )
    })

    it('generates draftPayload key with hash', () => {
      const key = StorageKeys.draftPayload('workflows/test.json', 'ws-1')

      expect(key).toMatch(/^Comfy\.Workflow\.Draft\.v2:ws-1:[0-9a-f]{8}$/)
    })

    it('generates consistent draftKey from path', () => {
      const key1 = StorageKeys.draftKey('workflows/test.json')
      const key2 = StorageKeys.draftKey('workflows/test.json')

      expect(key1).toBe(key2)
      expect(key1).toMatch(/^[0-9a-f]{8}$/)
    })

    it('generates activePath key with clientId', () => {
      expect(StorageKeys.activePath('client-abc')).toBe(
        'Comfy.Workflow.ActivePath:client-abc'
      )
    })

    it('generates openPaths key with clientId', () => {
      expect(StorageKeys.openPaths('client-abc')).toBe(
        'Comfy.Workflow.OpenPaths:client-abc'
      )
    })

    it('exposes prefix patterns for cleanup', () => {
      expect(StorageKeys.prefixes.draftIndex).toBe(
        'Comfy.Workflow.DraftIndex.v2:'
      )
      expect(StorageKeys.prefixes.draftPayload).toBe('Comfy.Workflow.Draft.v2:')
      expect(StorageKeys.prefixes.activePath).toBe('Comfy.Workflow.ActivePath:')
      expect(StorageKeys.prefixes.openPaths).toBe('Comfy.Workflow.OpenPaths:')
    })
  })
})
