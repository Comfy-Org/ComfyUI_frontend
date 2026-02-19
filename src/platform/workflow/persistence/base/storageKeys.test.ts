import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_DRAFTS, PERSIST_DEBOUNCE_MS } from './draftTypes'
import type {
  ActivePathPointer,
  DraftEntryMeta,
  DraftIndexV2,
  DraftPayloadV2,
  OpenPathsPointer
} from './draftTypes'

describe('storageKeys', () => {
  beforeEach(() => {
    vi.resetModules()
    sessionStorage.clear()
  })

  describe('draftTypes', () => {
    it('defines v2 draft payload shapes', () => {
      const entry: DraftEntryMeta = {
        path: 'workflows/test.json',
        name: 'Test Workflow',
        isTemporary: false,
        updatedAt: 1739962610000
      }
      const index: DraftIndexV2 = {
        v: 2,
        updatedAt: 1739962610000,
        order: ['draft-key'],
        entries: { 'draft-key': entry }
      }
      const payload: DraftPayloadV2 = {
        data: '{"nodes":[]}',
        updatedAt: 1739962610000
      }
      const activePath: ActivePathPointer = {
        workspaceId: 'ws-1',
        path: 'workflows/test.json'
      }
      const openPaths: OpenPathsPointer = {
        workspaceId: 'ws-1',
        paths: ['workflows/test.json'],
        activeIndex: 0
      }

      expect(index.entries['draft-key']?.name).toBe('Test Workflow')
      expect(payload.data).toContain('nodes')
      expect(activePath.workspaceId).toBe(openPaths.workspaceId)
      expect(MAX_DRAFTS).toBeGreaterThan(0)
      expect(PERSIST_DEBOUNCE_MS).toBeGreaterThan(0)
    })
  })

  describe('getWorkspaceId', () => {
    it('returns personal when no workspace is set', async () => {
      const { getWorkspaceId } = await import('./storageKeys')
      expect(getWorkspaceId()).toBe('personal')
    })

    it('returns personal for personal workspace type', async () => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'personal', id: null })
      )
      const { getWorkspaceId } = await import('./storageKeys')
      expect(getWorkspaceId()).toBe('personal')
    })

    it('returns workspace ID for team workspace', async () => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'team', id: 'ws-abc-123' })
      )
      const { getWorkspaceId } = await import('./storageKeys')
      expect(getWorkspaceId()).toBe('ws-abc-123')
    })

    it('returns personal when JSON parsing fails', async () => {
      sessionStorage.setItem('Comfy.Workspace.Current', 'invalid-json')
      const { getWorkspaceId } = await import('./storageKeys')
      expect(getWorkspaceId()).toBe('personal')
    })
  })

  describe('StorageKeys', () => {
    it('generates draftIndex key with workspace scope', async () => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'team', id: 'ws-123' })
      )
      const { StorageKeys } = await import('./storageKeys')

      expect(StorageKeys.draftIndex()).toBe(
        'Comfy.Workflow.DraftIndex.v2:ws-123'
      )
    })

    it('generates draftPayload key with hash', async () => {
      const { StorageKeys } = await import('./storageKeys')
      const key = StorageKeys.draftPayload('workflows/test.json', 'ws-1')

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
