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
  })
})
