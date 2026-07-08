import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DraftIndexV2, DraftPayloadV2 } from './draftTypes'
import {
  clearAllV2Storage,
  deleteOrphanPayloads,
  deletePayload,
  deletePayloads,
  getPayloadKeys,
  readActivePath,
  readIndex,
  readOpenPaths,
  readPayload,
  writeActivePath,
  writeIndex,
  writeOpenPaths,
  writePayload
} from './storageIO'

function createStorageStub(overrides: Partial<Storage> = {}): Storage {
  return fromPartial<Storage>({
    length: 0,
    clear: vi.fn(),
    getItem: vi.fn(() => null),
    key: vi.fn(() => null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
    ...overrides
  })
}

describe('storageIO', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
    sessionStorage.clear()
    vi.resetModules()
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

    it('returns null for malformed index shapes', () => {
      for (const value of [
        null,
        42,
        { v: 2, updatedAt: 'now', order: [], entries: {} },
        { v: 2, updatedAt: 1, order: {}, entries: {} },
        { v: 2, updatedAt: 1, order: [], entries: null }
      ]) {
        localStorage.setItem(
          'Comfy.Workflow.DraftIndex.v2:test-workspace',
          JSON.stringify(value)
        )
        expect(readIndex(workspaceId)).toBeNull()
      }
    })

    it('returns false for quota errors when writing an index', () => {
      vi.stubGlobal(
        'localStorage',
        createStorageStub({
          setItem: vi.fn(() => {
            throw new DOMException('full', 'QuotaExceededError')
          })
        })
      )
      const index: DraftIndexV2 = {
        v: 2,
        updatedAt: 1,
        order: [],
        entries: {}
      }

      expect(writeIndex(workspaceId, index)).toBe(false)
    })

    it('rethrows non-quota errors when writing an index', () => {
      vi.stubGlobal(
        'localStorage',
        createStorageStub({
          setItem: vi.fn(() => {
            throw new Error('storage failed')
          })
        })
      )
      const index: DraftIndexV2 = {
        v: 2,
        updatedAt: 1,
        order: [],
        entries: {}
      }

      expect(() => writeIndex(workspaceId, index)).toThrow('storage failed')
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

    it('returns null for invalid payload JSON', () => {
      localStorage.setItem(
        'Comfy.Workflow.Draft.v2:test-workspace:abc12345',
        'invalid'
      )

      expect(readPayload(workspaceId, draftKey)).toBeNull()
    })

    it('returns false for quota errors when writing payloads', () => {
      vi.stubGlobal(
        'localStorage',
        createStorageStub({
          setItem: vi.fn(() => {
            throw new DOMException('full', 'NS_ERROR_DOM_QUOTA_REACHED')
          })
        })
      )

      expect(
        writePayload(workspaceId, draftKey, { data: '{}', updatedAt: 1 })
      ).toBe(false)
    })

    it('rethrows non-quota errors when writing payloads', () => {
      vi.stubGlobal(
        'localStorage',
        createStorageStub({
          setItem: vi.fn(() => {
            throw new Error('storage failed')
          })
        })
      )

      expect(() =>
        writePayload(workspaceId, draftKey, { data: '{}', updatedAt: 1 })
      ).toThrow('storage failed')
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

    it('ignores delete errors', () => {
      const removeItem = vi.fn(() => {
        throw new Error('remove failed')
      })
      vi.stubGlobal('localStorage', createStorageStub({ removeItem }))

      expect(() => deletePayload(workspaceId, draftKey)).not.toThrow()
      expect(removeItem).toHaveBeenCalledWith(
        `Comfy.Workflow.Draft.v2:${workspaceId}:${draftKey}`
      )
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

    it('returns an empty list when key enumeration fails', () => {
      vi.stubGlobal(
        'localStorage',
        createStorageStub({
          length: 1,
          key: vi.fn(() => {
            throw new Error('key failed')
          })
        })
      )

      expect(getPayloadKeys('ws-1')).toEqual([])
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

    it('falls back to the last active path in localStorage', () => {
      const pointer = { workspaceId: 'ws-1', path: 'workflows/last.json' }
      localStorage.setItem(
        'Comfy.Workflow.LastActivePath:ws-1',
        JSON.stringify(pointer)
      )

      expect(readActivePath('missing-client', 'ws-1')).toEqual(pointer)
    })

    it('ignores invalid last active path pointers', () => {
      localStorage.setItem(
        'Comfy.Workflow.LastActivePath:ws-1',
        JSON.stringify({ workspaceId: 'ws-1', paths: [] })
      )

      expect(readActivePath('missing-client', 'ws-1')).toBeNull()
    })

    it('falls back to the last open paths in localStorage', () => {
      const pointer = {
        workspaceId: 'ws-1',
        paths: ['workflows/last.json'],
        activeIndex: 0
      }
      localStorage.setItem(
        'Comfy.Workflow.LastOpenPaths:ws-1',
        JSON.stringify(pointer)
      )

      expect(readOpenPaths('missing-client', 'ws-1')).toEqual(pointer)
    })

    it('ignores invalid migrated session pointers', () => {
      sessionStorage.setItem('Comfy.Workflow.OpenPaths:old-client', 'invalid')

      expect(readOpenPaths('new-client', 'ws-1')).toBeNull()
    })

    it('silently ignores pointer write failures', () => {
      const setItem = vi.fn(() => {
        throw new Error('write failed')
      })
      const storage = createStorageStub({ setItem })
      vi.stubGlobal('localStorage', storage)
      vi.stubGlobal('sessionStorage', storage)

      expect(() =>
        writeActivePath('client', {
          workspaceId: 'ws-1',
          path: 'workflows/a.json'
        })
      ).not.toThrow()
      expect(() =>
        writeOpenPaths('client', {
          workspaceId: 'ws-1',
          paths: ['workflows/a.json'],
          activeIndex: 0
        })
      ).not.toThrow()
      expect(setItem).toHaveBeenCalled()
      expect(readActivePath('client')).toBeNull()
      expect(readOpenPaths('client')).toBeNull()
    })
  })

  describe('clearAllV2Storage', () => {
    it('clears all V2 keys from localStorage', () => {
      localStorage.setItem('Comfy.Workflow.DraftIndex.v2:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:abc', '{}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-2:def', '{}')
      localStorage.setItem('unrelated', 'keep')

      clearAllV2Storage()

      expect(
        localStorage.getItem('Comfy.Workflow.DraftIndex.v2:ws-1')
      ).toBeNull()
      expect(
        localStorage.getItem('Comfy.Workflow.Draft.v2:ws-1:abc')
      ).toBeNull()
      expect(
        localStorage.getItem('Comfy.Workflow.Draft.v2:ws-2:def')
      ).toBeNull()
      expect(localStorage.getItem('unrelated')).toBe('keep')
    })

    it('clears all V2 keys from sessionStorage', () => {
      sessionStorage.setItem('Comfy.Workflow.ActivePath:client-1', '{}')
      sessionStorage.setItem('Comfy.Workflow.OpenPaths:client-2', '{}')
      sessionStorage.setItem('unrelated', 'keep')

      clearAllV2Storage()

      expect(
        sessionStorage.getItem('Comfy.Workflow.ActivePath:client-1')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.Workflow.OpenPaths:client-2')
      ).toBeNull()
      expect(sessionStorage.getItem('unrelated')).toBe('keep')
    })

    it('ignores storage cleanup failures', () => {
      const localRemoveItem = vi.fn(() => {
        throw new Error('remove failed')
      })
      const sessionRemoveItem = vi.fn(() => {
        throw new Error('remove failed')
      })
      vi.stubGlobal(
        'localStorage',
        createStorageStub({
          length: 1,
          key: vi.fn(() => 'Comfy.Workflow.Draft.v2:ws-1:abc'),
          removeItem: localRemoveItem
        })
      )
      vi.stubGlobal(
        'sessionStorage',
        createStorageStub({
          length: 1,
          key: vi.fn(() => 'Comfy.Workflow.ActivePath:client-1'),
          removeItem: sessionRemoveItem
        })
      )

      expect(() => clearAllV2Storage()).not.toThrow()
      expect(localRemoveItem).toHaveBeenCalledWith(
        'Comfy.Workflow.Draft.v2:ws-1:abc'
      )
      expect(sessionRemoveItem).toHaveBeenCalledWith(
        'Comfy.Workflow.ActivePath:client-1'
      )
    })
  })

  describe('storage availability', () => {
    it('returns empty results and rejects writes after storage is marked unavailable', async () => {
      const storage = await import('./storageIO')

      expect(storage.isStorageAvailable()).toBe(true)

      storage.markStorageUnavailable()

      expect(storage.isStorageAvailable()).toBe(false)
      expect(storage.readIndex('ws-1')).toBeNull()
      expect(storage.readPayload('ws-1', 'draft')).toBeNull()
      expect(storage.getPayloadKeys('ws-1')).toEqual([])
      expect(
        storage.writeIndex('ws-1', {
          v: 2,
          updatedAt: 1,
          order: [],
          entries: {}
        })
      ).toBe(false)
      expect(
        storage.writePayload('ws-1', 'draft', { data: '{}', updatedAt: 1 })
      ).toBe(false)
      expect(() => storage.clearAllV2Storage()).not.toThrow()
    })
  })
})
