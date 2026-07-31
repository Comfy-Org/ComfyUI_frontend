import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DraftIndexV2, DraftPayloadV2 } from './draftTypes'
import {
  clearAllWorkflowStorage,
  clearWorkflowRestoreState,
  deleteOrphanPayloads,
  deletePayload,
  deletePayloads,
  getPayloadKeys,
  markStorageUnavailable,
  readActivePath,
  readIndex,
  readOpenPaths,
  readPayload,
  writeActivePath,
  writeIndex,
  writeOpenPaths,
  writePayload
} from './storageIO'

describe('storageIO', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('index operations', () => {
    const workspaceId = 'test-workspace'

    it('reads and writes index', () => {
      const index: DraftIndexV2 = {
        v: 2,
        updatedAt: Date.now(),
        order: ['abc123'],
        entries: {
          abc123: {
            path: 'workflows/test.json',
            name: 'test',
            isTemporary: true,
            updatedAt: Date.now()
          }
        }
      }

      expect(writeIndex(workspaceId, index)).toBe(true)

      const read = readIndex(workspaceId)
      expect(read).not.toBeNull()
      expect(read!.v).toBe(2)
      expect(read!.order).toEqual(['abc123'])
    })

    it('returns null for missing index', () => {
      expect(readIndex(workspaceId)).toBeNull()
    })

    it('returns null for invalid JSON', () => {
      localStorage.setItem(
        'Comfy.Workflow.DraftIndex.v2:test-workspace',
        'invalid'
      )
      expect(readIndex(workspaceId)).toBeNull()
    })

    it('returns null for wrong version', () => {
      localStorage.setItem(
        'Comfy.Workflow.DraftIndex.v2:test-workspace',
        JSON.stringify({ v: 1 })
      )
      expect(readIndex(workspaceId)).toBeNull()
    })
  })

  describe('payload operations', () => {
    const workspaceId = 'test-workspace'
    const draftKey = 'abc12345'

    it('reads and writes payload', () => {
      const payload: DraftPayloadV2 = {
        data: '{"nodes":[]}',
        updatedAt: Date.now()
      }

      expect(writePayload(workspaceId, draftKey, payload)).toBe(true)

      const read = readPayload(workspaceId, draftKey)
      expect(read).not.toBeNull()
      expect(read!.data).toBe('{"nodes":[]}')
    })

    it('returns null for missing payload', () => {
      expect(readPayload(workspaceId, 'missing')).toBeNull()
    })

    it('deletes payload', () => {
      const payload: DraftPayloadV2 = {
        data: '{}',
        updatedAt: Date.now()
      }
      writePayload(workspaceId, draftKey, payload)
      expect(readPayload(workspaceId, draftKey)).not.toBeNull()

      deletePayload(workspaceId, draftKey)
      expect(readPayload(workspaceId, draftKey)).toBeNull()
    })

    it('deletes multiple payloads', () => {
      writePayload(workspaceId, 'key1', { data: '{}', updatedAt: 1 })
      writePayload(workspaceId, 'key2', { data: '{}', updatedAt: 2 })
      writePayload(workspaceId, 'key3', { data: '{}', updatedAt: 3 })

      deletePayloads(workspaceId, ['key1', 'key3'])

      expect(readPayload(workspaceId, 'key1')).toBeNull()
      expect(readPayload(workspaceId, 'key2')).not.toBeNull()
      expect(readPayload(workspaceId, 'key3')).toBeNull()
    })
  })

  describe('getPayloadKeys', () => {
    it('returns all payload keys for workspace', () => {
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:abc', '{"data":""}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:def', '{"data":""}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-2:ghi', '{"data":""}')
      localStorage.setItem('unrelated-key', 'value')

      const keys = getPayloadKeys('ws-1')
      expect(keys).toHaveLength(2)
      expect(keys).toContain('abc')
      expect(keys).toContain('def')
    })
  })

  describe('deleteOrphanPayloads', () => {
    it('deletes payloads not in index', () => {
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:keep', '{"data":""}')
      localStorage.setItem(
        'Comfy.Workflow.Draft.v2:ws-1:orphan1',
        '{"data":""}'
      )
      localStorage.setItem(
        'Comfy.Workflow.Draft.v2:ws-1:orphan2',
        '{"data":""}'
      )

      const indexKeys = new Set(['keep'])
      const deleted = deleteOrphanPayloads('ws-1', indexKeys)

      expect(deleted).toBe(2)
      expect(getPayloadKeys('ws-1')).toEqual(['keep'])
    })
  })

  describe('session storage pointers', () => {
    const clientId = 'client-abc'

    it('reads and writes active path pointer', () => {
      const pointer = { workspaceId: 'ws-1', path: 'workflows/test.json' }
      writeActivePath(clientId, pointer)

      const read = readActivePath(clientId)
      expect(read).toEqual(pointer)
    })

    it('returns null for missing active path', () => {
      expect(readActivePath('missing')).toBeNull()
    })

    it('reads and writes open paths pointer', () => {
      const pointer = {
        workspaceId: 'ws-1',
        paths: ['workflows/a.json', 'workflows/b.json'],
        activeIndex: 1
      }
      writeOpenPaths(clientId, pointer)

      const read = readOpenPaths(clientId)
      expect(read).toEqual(pointer)
    })

    it('returns null for missing open paths', () => {
      expect(readOpenPaths('missing')).toBeNull()
    })

    it('falls back to workspace search when clientId does not match and migrates', () => {
      const oldClientId = 'old-client'
      const newClientId = 'new-client'
      const workspaceId = 'ws-123'

      // Store pointer with old clientId
      const pointer = {
        workspaceId,
        paths: ['workflows/a.json', 'workflows/b.json'],
        activeIndex: 0
      }
      writeOpenPaths(oldClientId, pointer)

      // Read with new clientId but same workspace - should find via fallback
      const read = readOpenPaths(newClientId, workspaceId)
      expect(read).toEqual(pointer)

      // Should have migrated to new key and removed old key
      const oldKey = `Comfy.Workflow.OpenPaths:${oldClientId}`
      const newKey = `Comfy.Workflow.OpenPaths:${newClientId}`
      expect(sessionStorage.getItem(oldKey)).toBeNull()
      expect(sessionStorage.getItem(newKey)).not.toBeNull()
    })

    it('does not fall back to different workspace pointer', () => {
      const oldClientId = 'old-client'
      const newClientId = 'new-client'

      // Store pointer for workspace-A
      writeOpenPaths(oldClientId, {
        workspaceId: 'workspace-A',
        paths: ['workflows/a.json'],
        activeIndex: 0
      })

      // Read with new clientId looking for workspace-B - should not find
      const read = readOpenPaths(newClientId, 'workspace-B')
      expect(read).toBeNull()
    })

    it('prefers exact clientId match over fallback search', () => {
      const clientId = 'my-client'
      const workspaceId = 'ws-123'

      // Store pointer with different clientId for same workspace
      writeOpenPaths('other-client', {
        workspaceId,
        paths: ['workflows/old.json'],
        activeIndex: 0
      })

      // Store pointer with exact clientId match
      const exactPointer = {
        workspaceId,
        paths: ['workflows/exact.json'],
        activeIndex: 0
      }
      writeOpenPaths(clientId, exactPointer)

      // Should return exact match, not fallback
      const read = readOpenPaths(clientId, workspaceId)
      expect(read).toEqual(exactPointer)
    })

    it('removes stale exact match from wrong workspace and falls back', () => {
      const clientId = 'my-client'

      // Store pointer for workspace-A under this clientId
      writeActivePath(clientId, {
        workspaceId: 'ws-A',
        path: 'workflows/stale.json'
      })

      // Store pointer for workspace-B under a different clientId
      writeActivePath('old-client', {
        workspaceId: 'ws-B',
        path: 'workflows/correct.json'
      })

      // Reading with workspace-B should skip the stale ws-A pointer and find the fallback
      const result = readActivePath(clientId, 'ws-B')
      expect(result).toEqual({
        workspaceId: 'ws-B',
        path: 'workflows/correct.json'
      })

      // Stale pointer should have been removed
      const raw = sessionStorage.getItem(
        `Comfy.Workflow.ActivePath:${clientId}`
      )
      expect(JSON.parse(raw!).workspaceId).toBe('ws-B')
    })
  })

  describe('clearAllWorkflowStorage', () => {
    it('clears all restorable workflow keys from localStorage', () => {
      localStorage.setItem('Comfy.Workflow.DraftIndex.v2:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:abc', '{}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-2:def', '{}')
      localStorage.setItem('Comfy.Workflow.LastActivePath:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.LastOpenPaths:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.Drafts:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.DraftOrder:ws-1', '[]')
      localStorage.setItem('Comfy.Workflow.Drafts', '{}')
      localStorage.setItem('Comfy.Workflow.DraftOrder', '[]')
      localStorage.setItem('Comfy.OpenWorkflowsPaths', '[]')
      localStorage.setItem('Comfy.ActiveWorkflowIndex', '0')
      localStorage.setItem('Comfy.PreviousWorkflow', 'workflows/old.json')
      localStorage.setItem('workflow', '{}')
      localStorage.setItem('unrelated', 'keep')

      clearAllWorkflowStorage()

      expect(
        [...Array(localStorage.length)].map((_, index) =>
          localStorage.key(index)
        )
      ).toEqual(['unrelated'])
      expect(localStorage.getItem('unrelated')).toBe('keep')
    })

    it('clears all restorable workflow keys from sessionStorage', () => {
      sessionStorage.setItem('Comfy.Workflow.ActivePath:client-1', '{}')
      sessionStorage.setItem('Comfy.Workflow.OpenPaths:client-2', '{}')
      sessionStorage.setItem('Comfy.PreviousWorkflow', 'workflows/old.json')
      sessionStorage.setItem(
        'Comfy.PreviousWorkflow:client-1',
        'workflows/old.json'
      )
      sessionStorage.setItem('Comfy.OpenWorkflowsPaths:client-1', '[]')
      sessionStorage.setItem('Comfy.ActiveWorkflowIndex:client-1', '0')
      sessionStorage.setItem('workflow:client-1', '{}')
      sessionStorage.setItem('unrelated', 'keep')

      clearAllWorkflowStorage()

      expect(
        sessionStorage.getItem('Comfy.Workflow.ActivePath:client-1')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.Workflow.OpenPaths:client-2')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.PreviousWorkflow:client-1')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.OpenWorkflowsPaths:client-1')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.ActiveWorkflowIndex:client-1')
      ).toBeNull()
      expect(sessionStorage.getItem('workflow:client-1')).toBeNull()
      expect(sessionStorage.getItem('unrelated')).toBe('keep')
    })

    it('blocks workflow writes after cleanup starts', async () => {
      const isolatedStorageIO = await import('./storageIO')

      isolatedStorageIO.clearAllWorkflowStorage({ blockWrites: true })

      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)
      expect(
        isolatedStorageIO.writeIndex('ws-1', {
          v: 2,
          updatedAt: 1,
          order: [],
          entries: {}
        })
      ).toBe(false)
      expect(
        isolatedStorageIO.writePayload('ws-1', 'draft-1', {
          data: '{}',
          updatedAt: 1
        })
      ).toBe(false)
      isolatedStorageIO.writeActivePath('client-1', {
        workspaceId: 'ws-1',
        path: 'workflows/a.json'
      })
      isolatedStorageIO.writeOpenPaths('client-1', {
        workspaceId: 'ws-1',
        paths: ['workflows/a.json'],
        activeIndex: 0
      })

      expect(localStorage).toHaveLength(0)
      expect(sessionStorage).toHaveLength(0)
    })

    it('clears persisted workflows after storage writes are disabled', () => {
      localStorage.setItem('Comfy.Workflow.LastActivePath:personal', '{}')
      sessionStorage.setItem('Comfy.Workflow.ActivePath:client-1', '{}')
      markStorageUnavailable()

      clearAllWorkflowStorage()

      expect(
        localStorage.getItem('Comfy.Workflow.LastActivePath:personal')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.Workflow.ActivePath:client-1')
      ).toBeNull()
    })
  })

  describe('clearWorkflowRestoreState', () => {
    it('blocks writes and clears restore state when a persistence flush fails', async () => {
      const isolatedStorageIO = await import('./storageIO')
      localStorage.setItem('workflow', '{}')
      const successfulFlush = vi.fn()
      const flushError = new DOMException(
        'Storage unavailable',
        'SecurityError'
      )
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})
      const unregisterFailedFlush =
        isolatedStorageIO.registerWorkflowPersistenceFlush(() => {
          throw flushError
        })
      const unregisterSuccessfulFlush =
        isolatedStorageIO.registerWorkflowPersistenceFlush(successfulFlush)

      expect(() =>
        isolatedStorageIO.prepareWorkflowWorkspaceTransition()
      ).not.toThrow()

      expect(successfulFlush).toHaveBeenCalledOnce()
      expect(localStorage.getItem('workflow')).toBeNull()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to flush pending workflow persistence',
        flushError
      )
      unregisterFailedFlush()
      unregisterSuccessfulFlush()
      consoleWarnSpy.mockRestore()
    })

    it('clears cross-workspace restore state without deleting scoped drafts', () => {
      localStorage.setItem('Comfy.Workflow.DraftIndex.v2:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:abc', '{}')
      localStorage.setItem('Comfy.Workflow.LastOpenPaths:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.Drafts:ws-1', '{}')
      localStorage.setItem('Comfy.OpenWorkflowsPaths', '["a.json"]')
      localStorage.setItem('Comfy.ActiveWorkflowIndex', '0')
      localStorage.setItem('workflow', '{}')
      sessionStorage.setItem('Comfy.Workflow.ActivePath:client-1', '{}')
      sessionStorage.setItem('Comfy.Workflow.OpenPaths:client-1', '{}')
      sessionStorage.setItem('workflow:client-1', '{}')
      sessionStorage.setItem('unrelated', 'keep')

      clearWorkflowRestoreState()

      expect(localStorage.getItem('Comfy.OpenWorkflowsPaths')).toBeNull()
      expect(localStorage.getItem('Comfy.ActiveWorkflowIndex')).toBeNull()
      expect(localStorage.getItem('workflow')).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.Workflow.ActivePath:client-1')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.Workflow.OpenPaths:client-1')
      ).toBeNull()
      expect(sessionStorage.getItem('workflow:client-1')).toBeNull()
      expect(sessionStorage).toHaveLength(1)
      expect(sessionStorage.getItem('unrelated')).toBe('keep')
      expect(localStorage.getItem('Comfy.Workflow.DraftIndex.v2:ws-1')).toBe(
        '{}'
      )
      expect(localStorage.getItem('Comfy.Workflow.Draft.v2:ws-1:abc')).toBe(
        '{}'
      )
      expect(localStorage.getItem('Comfy.Workflow.LastOpenPaths:ws-1')).toBe(
        '{}'
      )
      expect(localStorage.getItem('Comfy.Workflow.Drafts:ws-1')).toBe('{}')
    })
  })
})
