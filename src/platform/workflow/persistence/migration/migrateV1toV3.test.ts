import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readIndex, readOpenPaths, readPayload } from '../base/storageIO'
import { isV3MigrationComplete, migrateV1toV3 } from './migrateV1toV3'

describe('migrateV1toV3', () => {
  const workspaceId = 'test-workspace'

  beforeEach(() => {
    vi.resetModules()
  })

  function setV1Data(
    drafts: Record<
      string,
      { data: string; updatedAt: number; name: string; isTemporary: boolean }
    >,
    order: string[]
  ) {
    localStorage.setItem(
      `Comfy.Workflow.Drafts:${workspaceId}`,
      JSON.stringify(drafts)
    )
    localStorage.setItem(
      `Comfy.Workflow.DraftOrder:${workspaceId}`,
      JSON.stringify(order)
    )
  }

  describe('isV3MigrationComplete', () => {
    it('returns false when no V3 index exists', () => {
      expect(isV3MigrationComplete(workspaceId)).toBe(false)
    })

    it('returns true when V3 index exists', () => {
      localStorage.setItem(
        `Comfy.Workflow.DraftIndex.v3:${workspaceId}`,
        JSON.stringify({ v: 3, order: [], entries: {}, updatedAt: Date.now() })
      )
      expect(isV3MigrationComplete(workspaceId)).toBe(true)
    })
  })

  describe('migrateV1toV3', () => {
    it('returns -1 if V3 already exists', () => {
      localStorage.setItem(
        `Comfy.Workflow.DraftIndex.v3:${workspaceId}`,
        JSON.stringify({ v: 3, order: [], entries: {}, updatedAt: Date.now() })
      )

      expect(migrateV1toV3(workspaceId)).toBe(-1)
    })

    it('returns -1 without writing V3 while a V2 index exists', () => {
      localStorage.setItem(
        `Comfy.Workflow.Drafts:${workspaceId}`,
        JSON.stringify({
          'workflows/stale.json': {
            data: '{"id":"stale"}',
            updatedAt: 1000,
            name: 'stale',
            isTemporary: false
          }
        })
      )
      localStorage.setItem(
        `Comfy.Workflow.DraftIndex.v2:${workspaceId}`,
        JSON.stringify({ v: 2, updatedAt: 2000, order: [], entries: {} })
      )

      expect(migrateV1toV3(workspaceId)).toBe(-1)
      expect(readIndex(workspaceId)).toBeNull()
      expect(readPayload(workspaceId, 'workflows/stale.json')).toBeNull()
    })

    it('creates empty V3 index if no V1 data', () => {
      expect(migrateV1toV3(workspaceId)).toBe(0)

      const indexJson = localStorage.getItem(
        `Comfy.Workflow.DraftIndex.v3:${workspaceId}`
      )
      expect(indexJson).not.toBeNull()

      const index = JSON.parse(indexJson!)
      expect(index.v).toBe(3)
      expect(index.order).toEqual([])
    })

    it('migrates V1 drafts to V3 format', () => {
      const v1Drafts = {
        'workflows/a.json': {
          data: '{"nodes":[1]}',
          updatedAt: 1000,
          name: 'a',
          isTemporary: true
        },
        'workflows/b.json': {
          data: '{"nodes":[2]}',
          updatedAt: 2000,
          name: 'b',
          isTemporary: false
        }
      }
      setV1Data(v1Drafts, ['workflows/a.json', 'workflows/b.json'])

      const migrated = migrateV1toV3(workspaceId)
      expect(migrated).toBe(2)

      // Check V3 index
      const indexJson = localStorage.getItem(
        `Comfy.Workflow.DraftIndex.v3:${workspaceId}`
      )
      const index = JSON.parse(indexJson!)
      expect(index.order).toHaveLength(2)

      // Check payloads
      const payloadA = localStorage.getItem(
        `Comfy.Workflow.Draft.v3:${workspaceId}:workflows/a.json`
      )
      const payloadB = localStorage.getItem(
        `Comfy.Workflow.Draft.v3:${workspaceId}:workflows/b.json`
      )

      expect(payloadA).not.toBeNull()
      expect(payloadB).not.toBeNull()

      expect(JSON.parse(payloadA!).data).toBe('{"nodes":[1]}')
      expect(JSON.parse(payloadB!).data).toBe('{"nodes":[2]}')
      expect(JSON.parse(payloadA!).path).toBe('workflows/a.json')
      expect(JSON.parse(payloadB!).path).toBe('workflows/b.json')
    })

    it('preserves known colliding V2-hash paths from the V1 blob', () => {
      setV1Data(
        {
          'workflows/ewip.json': {
            data: '{"id":"a"}',
            updatedAt: 1000,
            name: 'a',
            isTemporary: true
          },
          'workflows/4hbab.json': {
            data: '{"id":"b"}',
            updatedAt: 2000,
            name: 'b',
            isTemporary: true
          }
        },
        ['workflows/ewip.json', 'workflows/4hbab.json']
      )

      expect(migrateV1toV3(workspaceId)).toBe(2)
      expect(
        JSON.parse(
          localStorage.getItem(`Comfy.Workflow.DraftIndex.v3:${workspaceId}`)!
        ).order
      ).toEqual(['workflows/ewip.json', 'workflows/4hbab.json'])
    })

    it('preserves LRU order during migration', () => {
      const v1Drafts = {
        'workflows/first.json': {
          data: '{}',
          updatedAt: 1000,
          name: 'first',
          isTemporary: true
        },
        'workflows/second.json': {
          data: '{}',
          updatedAt: 2000,
          name: 'second',
          isTemporary: true
        },
        'workflows/third.json': {
          data: '{}',
          updatedAt: 3000,
          name: 'third',
          isTemporary: true
        }
      }
      setV1Data(v1Drafts, [
        'workflows/first.json',
        'workflows/second.json',
        'workflows/third.json'
      ])

      migrateV1toV3(workspaceId)

      const indexJson = localStorage.getItem(
        `Comfy.Workflow.DraftIndex.v3:${workspaceId}`
      )
      const index = JSON.parse(indexJson!)

      // Order should be preserved (oldest to newest)
      const expectedOrder = [
        'workflows/first.json',
        'workflows/second.json',
        'workflows/third.json'
      ]
      expect(index.order).toEqual(expectedOrder)
    })
  })

  describe('V1 tab state migration', () => {
    it('migrates V1 tab state pointers to V2 format', () => {
      // Simulate V1 state: user had 3 workflows open, 2nd was active
      const v1Drafts = {
        'workflows/a.json': {
          data: '{"nodes":[1]}',
          updatedAt: 1000,
          name: 'a',
          isTemporary: true
        },
        'workflows/b.json': {
          data: '{"nodes":[2]}',
          updatedAt: 2000,
          name: 'b',
          isTemporary: true
        },
        'workflows/c.json': {
          data: '{"nodes":[3]}',
          updatedAt: 3000,
          name: 'c',
          isTemporary: false
        }
      }
      setV1Data(v1Drafts, [
        'workflows/a.json',
        'workflows/b.json',
        'workflows/c.json'
      ])

      // V1 tab state stored by setStorageValue (localStorage fallback keys)
      localStorage.setItem(
        'Comfy.OpenWorkflowsPaths',
        JSON.stringify([
          'workflows/a.json',
          'workflows/b.json',
          'workflows/c.json'
        ])
      )
      localStorage.setItem('Comfy.ActiveWorkflowIndex', JSON.stringify(1))

      // Run migration (simulating upgrade from pre-V2 to V2)
      const clientId = 'client-123'
      const result = migrateV1toV3(workspaceId, clientId)
      expect(result).toBe(3)

      // V2 tab state should be readable via the V2 API
      const openPaths = readOpenPaths(clientId, workspaceId)

      // V2 tab state should be reconstructed from V1 localStorage keys
      expect(openPaths).not.toBeNull()
      expect(openPaths!.paths).toEqual([
        'workflows/a.json',
        'workflows/b.json',
        'workflows/c.json'
      ])
      expect(openPaths!.activeIndex).toBe(1)
    })

    it('does not migrate tab state when V1 tab state keys are absent', () => {
      const v1Drafts = {
        'workflows/a.json': {
          data: '{}',
          updatedAt: 1000,
          name: 'a',
          isTemporary: true
        }
      }
      setV1Data(v1Drafts, ['workflows/a.json'])

      // No V1 tab state keys in localStorage
      migrateV1toV3(workspaceId)

      const openPaths = readOpenPaths('any-client-id', workspaceId)

      // No tab state to migrate — should remain null
      expect(openPaths).toBeNull()
    })
  })
})
