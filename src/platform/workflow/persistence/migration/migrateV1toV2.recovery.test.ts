import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_DRAFTS } from '../base/draftTypes'
import { hashPath } from '../base/hashUtil'
import { readOpenPaths, writeOpenPaths } from '../base/storageIO'
import {
  cleanupV1Data,
  getMigrationStatus,
  isV2MigrationComplete,
  migrateV1toV2
} from './migrateV1toV2'

type V1Drafts = Record<
  string,
  { data: string; updatedAt: number; name: string; isTemporary: boolean }
>

const makeDraft = (id: string, updatedAt: number, isTemporary = true) => ({
  data: JSON.stringify({ id }),
  updatedAt,
  name: id,
  isTemporary
})

class FaultInjectingStorage implements Storage {
  private readonly values = new Map<string, string>()

  constructor(
    source: Storage,
    private readonly writeError: (key: string, value: string) => Error | null,
    private readonly readError: (key: string) => Error | null = () => null
  ) {
    for (let i = 0; i < source.length; i++) {
      const key = source.key(i)
      if (key !== null) {
        const value = source.getItem(key)
        if (value !== null) this.values.set(key, value)
      }
    }
  }

  get length(): number {
    return this.values.size
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    const error = this.readError(key)
    if (error) throw error
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    const error = this.writeError(key, value)
    if (error) throw error
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  clear(): void {
    this.values.clear()
  }
}

function installFaultStorage(
  writeError: (key: string, value: string) => Error | null,
  readError: (key: string) => Error | null = () => null
): () => void {
  const original = globalThis.localStorage
  const faultStorage = new FaultInjectingStorage(
    original,
    writeError,
    readError
  )
  Object.defineProperty(globalThis, 'localStorage', {
    value: faultStorage,
    configurable: true
  })

  return () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: original,
      configurable: true
    })
  }
}

describe('migrateV1toV2', () => {
  const personalWorkspace = 'personal'
  const teamWorkspace = 'test-workspace'

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  function setActualV1Data(drafts: V1Drafts, order: string[]) {
    localStorage.setItem('Comfy.Workflow.Drafts', JSON.stringify(drafts))
    localStorage.setItem('Comfy.Workflow.DraftOrder', JSON.stringify(order))
  }

  function setScopedV1Data(
    workspaceId: string,
    drafts: V1Drafts,
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

  function setV2Index(
    workspaceId: string,
    entries: Record<
      string,
      {
        path: string
        name: string
        isTemporary: boolean
        updatedAt: number
      }
    >,
    order: string[]
  ) {
    localStorage.setItem(
      `Comfy.Workflow.DraftIndex.v2:${workspaceId}`,
      JSON.stringify({ v: 2, updatedAt: Date.now(), order, entries })
    )
  }

  function getV2Payload(workspaceId: string, path: string) {
    const raw = localStorage.getItem(
      `Comfy.Workflow.Draft.v2:${workspaceId}:${hashPath(path)}`
    )
    return raw ? (JSON.parse(raw) as { data: string; updatedAt: number }) : null
  }

  function getV2Index(workspaceId: string) {
    const raw = localStorage.getItem(
      `Comfy.Workflow.DraftIndex.v2:${workspaceId}`
    )
    return raw
      ? (JSON.parse(raw) as {
          v: number
          order: string[]
          entries: Record<string, { path: string }>
        })
      : null
  }

  describe('migration completeness', () => {
    it('is incomplete when the actual V1 blob remains behind an existing V2 index', () => {
      setV2Index(personalWorkspace, {}, [])
      setActualV1Data({ 'workflows/legacy.json': makeDraft('legacy', 1) }, [
        'workflows/legacy.json'
      ])

      expect(isV2MigrationComplete(personalWorkspace)).toBe(false)
    })

    it('is complete when a V2 index exists and no relevant V1 blob remains', () => {
      setV2Index(personalWorkspace, {}, [])
      expect(isV2MigrationComplete(personalWorkspace)).toBe(true)
    })

    it('cleans an exact-match legacy workflow singleton after draft migration already completed', () => {
      const path = 'workflows/current.json'
      const draftKey = hashPath(path)
      const data = '{"already":"v2"}'
      setV2Index(
        personalWorkspace,
        {
          [draftKey]: {
            path,
            name: 'current',
            isTemporary: true,
            updatedAt: 1000
          }
        },
        [draftKey]
      )
      localStorage.setItem(
        `Comfy.Workflow.Draft.v2:${personalWorkspace}:${draftKey}`,
        JSON.stringify({ data, updatedAt: 1000 })
      )
      localStorage.setItem('workflow', data)

      expect(migrateV1toV2(personalWorkspace)).toBe(-1)
      expect(localStorage.getItem('workflow')).toBeNull()
      expect(getV2Payload(personalWorkspace, path)?.data).toBe(data)
    })

    it('keeps a unique legacy workflow singleton after draft migration already completed', () => {
      const path = 'workflows/current.json'
      const draftKey = hashPath(path)
      setV2Index(
        personalWorkspace,
        {
          [draftKey]: {
            path,
            name: 'current',
            isTemporary: true,
            updatedAt: 1000
          }
        },
        [draftKey]
      )
      localStorage.setItem(
        `Comfy.Workflow.Draft.v2:${personalWorkspace}:${draftKey}`,
        JSON.stringify({ data: '{"already":"v2"}', updatedAt: 1000 })
      )
      localStorage.setItem('workflow', '{"unique":"legacy"}')

      expect(migrateV1toV2(personalWorkspace)).toBe(-1)
      expect(localStorage.getItem('workflow')).toBe('{"unique":"legacy"}')
    })

    it('degrades safely when localStorage reads are blocked', () => {
      const restoreStorage = installFaultStorage(
        () => null,
        () => new DOMException('Storage blocked', 'SecurityError')
      )

      try {
        expect(migrateV1toV2(personalWorkspace)).toBe(-1)
        expect(isV2MigrationComplete(personalWorkspace)).toBe(false)
        expect(getMigrationStatus(personalWorkspace)).toEqual({
          v1Exists: false,
          v2Exists: false,
          v1DraftCount: 0,
          v2DraftCount: 0
        })
      } finally {
        restoreStorage()
      }
    })
  })

  describe('legacy key compatibility', () => {
    it('migrates the unscoped keys written by the real V1 draft store', () => {
      const drafts = {
        'workflows/a.json': makeDraft('a', 1000),
        'workflows/b.json': makeDraft('b', 2000, false)
      }
      setActualV1Data(drafts, ['workflows/a.json', 'workflows/b.json'])

      expect(migrateV1toV2(personalWorkspace)).toBe(2)

      expect(getV2Payload(personalWorkspace, 'workflows/a.json')?.data).toBe(
        drafts['workflows/a.json'].data
      )
      expect(getV2Payload(personalWorkspace, 'workflows/b.json')?.data).toBe(
        drafts['workflows/b.json'].data
      )
      expect(getV2Index(personalWorkspace)?.order).toEqual([
        hashPath('workflows/a.json'),
        hashPath('workflows/b.json')
      ])
      expect(localStorage.getItem('Comfy.Workflow.Drafts')).toBeNull()
      expect(localStorage.getItem('Comfy.Workflow.DraftOrder')).toBeNull()
    })

    it('repairs a prior empty V2 migration marker instead of short-circuiting', () => {
      setV2Index(personalWorkspace, {}, [])
      setActualV1Data(
        { 'workflows/recovered.json': makeDraft('recovered', 1000) },
        ['workflows/recovered.json']
      )

      expect(migrateV1toV2(personalWorkspace)).toBe(1)
      expect(
        getV2Payload(personalWorkspace, 'workflows/recovered.json')?.data
      ).toBe(JSON.stringify({ id: 'recovered' }))
    })

    it('keeps compatibility with interim workspace-scoped legacy keys', () => {
      setScopedV1Data(
        teamWorkspace,
        { 'workflows/team.json': makeDraft('team', 1000) },
        ['workflows/team.json']
      )

      expect(migrateV1toV2(teamWorkspace)).toBe(1)
      expect(getV2Payload(teamWorkspace, 'workflows/team.json')?.data).toBe(
        JSON.stringify({ id: 'team' })
      )
      expect(
        localStorage.getItem(`Comfy.Workflow.Drafts:${teamWorkspace}`)
      ).toBeNull()
    })

    it('does not adopt unscoped V1 drafts into a team workspace', () => {
      setActualV1Data(
        { 'workflows/personal.json': makeDraft('personal', 1000) },
        ['workflows/personal.json']
      )

      expect(migrateV1toV2(teamWorkspace)).toBe(0)
      expect(getV2Index(teamWorkspace)?.order).toEqual([])
      expect(localStorage.getItem('Comfy.Workflow.Drafts')).not.toBeNull()
    })

    it('recovers valid drafts when the legacy order key is missing', () => {
      localStorage.setItem(
        'Comfy.Workflow.Drafts',
        JSON.stringify({
          'workflows/b.json': makeDraft('b', 2000),
          'workflows/a.json': makeDraft('a', 1000)
        })
      )

      expect(migrateV1toV2(personalWorkspace)).toBe(2)
      expect(getV2Index(personalWorkspace)?.order).toEqual([
        hashPath('workflows/a.json'),
        hashPath('workflows/b.json')
      ])
    })
  })

  describe('V2 repair', () => {
    it('preserves an existing V2 payload when V1 has an older copy', () => {
      const path = 'workflows/current.json'
      const draftKey = hashPath(path)
      setV2Index(
        personalWorkspace,
        {
          [draftKey]: {
            path,
            name: 'current',
            isTemporary: true,
            updatedAt: 3000
          }
        },
        [draftKey]
      )
      localStorage.setItem(
        `Comfy.Workflow.Draft.v2:${personalWorkspace}:${draftKey}`,
        JSON.stringify({ data: '{"version":2}', updatedAt: 3000 })
      )
      setActualV1Data(
        {
          [path]: {
            data: '{"version":1}',
            updatedAt: 1000,
            name: 'current',
            isTemporary: true
          }
        },
        [path]
      )

      expect(migrateV1toV2(personalWorkspace)).toBe(0)
      expect(getV2Payload(personalWorkspace, path)?.data).toBe('{"version":2}')
      expect(localStorage.getItem('Comfy.Workflow.Drafts')).toBeNull()
    })

    it('restores a V2 index entry whose payload was lost', () => {
      const path = 'workflows/lost-payload.json'
      const draftKey = hashPath(path)
      setV2Index(
        personalWorkspace,
        {
          [draftKey]: {
            path,
            name: 'current-name',
            isTemporary: true,
            updatedAt: 3000
          }
        },
        [draftKey]
      )
      setActualV1Data({ [path]: makeDraft('legacy-backup', 1000) }, [path])

      expect(migrateV1toV2(personalWorkspace)).toBe(1)
      expect(getV2Payload(personalWorkspace, path)?.data).toBe(
        JSON.stringify({ id: 'legacy-backup' })
      )
      expect(getV2Index(personalWorkspace)?.entries[draftKey].path).toBe(path)
    })

    it('keeps current V2 history ahead of recovered legacy-only history', () => {
      const currentPath = 'workflows/current.json'
      const currentKey = hashPath(currentPath)
      setV2Index(
        personalWorkspace,
        {
          [currentKey]: {
            path: currentPath,
            name: 'current',
            isTemporary: true,
            updatedAt: 3000
          }
        },
        [currentKey]
      )
      localStorage.setItem(
        `Comfy.Workflow.Draft.v2:${personalWorkspace}:${currentKey}`,
        JSON.stringify({ data: '{"current":true}', updatedAt: 3000 })
      )
      setActualV1Data(
        {
          'workflows/legacy-a.json': makeDraft('legacy-a', 1000),
          'workflows/legacy-b.json': makeDraft('legacy-b', 2000)
        },
        ['workflows/legacy-a.json', 'workflows/legacy-b.json']
      )

      expect(migrateV1toV2(personalWorkspace)).toBe(2)
      expect(getV2Index(personalWorkspace)?.order).toEqual([
        hashPath('workflows/legacy-a.json'),
        hashPath('workflows/legacy-b.json'),
        currentKey
      ])
    })
  })

  describe('retention limits', () => {
    it('keeps existing V2 history ahead of over-limit legacy-only drafts', () => {
      const existingPaths = [
        'workflows/v2-a.json',
        'workflows/v2-b.json',
        'workflows/v2-c.json'
      ]
      const existingEntries: Record<
        string,
        {
          path: string
          name: string
          isTemporary: boolean
          updatedAt: number
        }
      > = {}
      const existingOrder: string[] = []

      existingPaths.forEach((existingPath, index) => {
        const key = hashPath(existingPath)
        existingOrder.push(key)
        existingEntries[key] = {
          path: existingPath,
          name: `v2-${index}`,
          isTemporary: true,
          updatedAt: 10_000 + index
        }
        localStorage.setItem(
          `Comfy.Workflow.Draft.v2:${personalWorkspace}:${key}`,
          JSON.stringify({
            data: JSON.stringify({ existing: index }),
            updatedAt: 10_000 + index
          })
        )
      })
      setV2Index(personalWorkspace, existingEntries, existingOrder)

      const legacyPaths = Array.from(
        { length: MAX_DRAFTS + 4 },
        (_, index) => `workflows/legacy-${index}.json`
      )
      const legacyDrafts: V1Drafts = {}
      legacyPaths.forEach((legacyPath, index) => {
        legacyDrafts[legacyPath] = makeDraft(`legacy-${index}`, index + 1)
      })
      setActualV1Data(legacyDrafts, legacyPaths)

      expect(migrateV1toV2(personalWorkspace)).toBe(
        MAX_DRAFTS - existingPaths.length
      )

      const index = getV2Index(personalWorkspace)
      expect(index?.order).toHaveLength(MAX_DRAFTS)
      for (const existingPath of existingPaths) {
        const key = hashPath(existingPath)
        expect(index?.order).toContain(key)
        expect(getV2Payload(personalWorkspace, existingPath)).not.toBeNull()
      }

      const discardedLegacyPath = legacyPaths[0]
      expect(index?.order).not.toContain(hashPath(discardedLegacyPath))
      expect(getV2Payload(personalWorkspace, discardedLegacyPath)).toBeNull()
    })

    it('does not write payloads for over-limit discarded V2 recovery candidates', () => {
      const paths = Array.from(
        { length: MAX_DRAFTS + 2 },
        (_, index) => `workflows/recoverable-v2-${index}.json`
      )
      const entries: Record<
        string,
        {
          path: string
          name: string
          isTemporary: boolean
          updatedAt: number
        }
      > = {}
      const order: string[] = []
      const backups: V1Drafts = {}

      paths.forEach((workflowPath, index) => {
        const key = hashPath(workflowPath)
        order.push(key)
        entries[key] = {
          path: workflowPath,
          name: `recoverable-${index}`,
          isTemporary: true,
          updatedAt: index + 1
        }
        backups[workflowPath] = makeDraft(`backup-${index}`, index + 1)
      })
      // Every V2 index entry is missing its payload but is recoverable from V1.
      // This intentionally fills payloadsToWrite before retainedExisting trims
      // the over-limit index, exercising the pruning loop directly.
      setV2Index(personalWorkspace, entries, order)
      setActualV1Data(backups, paths)

      expect(migrateV1toV2(personalWorkspace)).toBe(MAX_DRAFTS)

      const index = getV2Index(personalWorkspace)
      expect(index?.order).toHaveLength(MAX_DRAFTS)
      const discardedPath = paths[0]
      const retainedPath = paths.at(-1)!
      expect(index?.order).not.toContain(hashPath(discardedPath))
      expect(index?.order).toContain(hashPath(retainedPath))
      expect(getV2Payload(personalWorkspace, discardedPath)).toBeNull()
      expect(getV2Payload(personalWorkspace, retainedPath)).not.toBeNull()
    })
  })

  describe('quota recovery', () => {
    it('preserves legacy recovery data when workflow writes are deliberately blocked', async () => {
      // Use fresh module instances so the deliberate transition fence is
      // isolated from the rest of this suite.
      vi.resetModules()
      const storageIO = await import('../base/storageIO')
      const migration = await import('./migrateV1toV2')
      storageIO.prepareWorkflowWorkspaceTransition()

      const drafts = {
        'workflows/blocked.json': makeDraft('blocked', 1000)
      }
      setActualV1Data(drafts, ['workflows/blocked.json'])
      const originalDrafts = localStorage.getItem('Comfy.Workflow.Drafts')
      const originalOrder = localStorage.getItem('Comfy.Workflow.DraftOrder')

      try {
        expect(migration.migrateV1toV2(personalWorkspace)).toBe(-1)
        expect(localStorage.getItem('Comfy.Workflow.Drafts')).toBe(
          originalDrafts
        )
        expect(localStorage.getItem('Comfy.Workflow.DraftOrder')).toBe(
          originalOrder
        )
        expect(
          localStorage.getItem(
            `Comfy.Workflow.Draft.v2:${personalWorkspace}:${hashPath('workflows/blocked.json')}`
          )
        ).toBeNull()
        expect(getV2Index(personalWorkspace)).toBeNull()
      } finally {
        vi.resetModules()
      }
    })

    it('frees the legacy blob and retries when duplication itself hits quota', () => {
      setActualV1Data({ 'workflows/large.json': makeDraft('large', 1000) }, [
        'workflows/large.json'
      ])

      const restoreStorage = installFaultStorage((key) =>
        key.startsWith('Comfy.Workflow.Draft.v2:') &&
        localStorage.getItem('Comfy.Workflow.Drafts') !== null
          ? new DOMException('Quota exceeded', 'QuotaExceededError')
          : null
      )
      try {
        expect(migrateV1toV2(personalWorkspace)).toBe(1)
        expect(
          getV2Payload(personalWorkspace, 'workflows/large.json')
        ).not.toBeNull()
        expect(localStorage.getItem('Comfy.Workflow.Drafts')).toBeNull()
      } finally {
        restoreStorage()
      }
    })

    it('restores the legacy blob when recovery still cannot be committed', () => {
      const drafts = {
        'workflows/large.json': makeDraft('large', 1000)
      }
      setActualV1Data(drafts, ['workflows/large.json'])
      const originalDrafts = localStorage.getItem('Comfy.Workflow.Drafts')
      const originalOrder = localStorage.getItem('Comfy.Workflow.DraftOrder')

      const restoreStorage = installFaultStorage((key) =>
        key.startsWith('Comfy.Workflow.Draft.v2:')
          ? new DOMException('Quota exceeded', 'QuotaExceededError')
          : null
      )
      try {
        expect(migrateV1toV2(personalWorkspace)).toBe(-1)
        expect(localStorage.getItem('Comfy.Workflow.Drafts')).toBe(
          originalDrafts
        )
        expect(localStorage.getItem('Comfy.Workflow.DraftOrder')).toBe(
          originalOrder
        )
        expect(
          getV2Payload(personalWorkspace, 'workflows/large.json')
        ).toBeNull()
        expect(getV2Index(personalWorkspace)).toBeNull()
      } finally {
        restoreStorage()
      }
    })

    it('does not delete legacy data after a non-quota storage failure', () => {
      setActualV1Data({ 'workflows/legacy.json': makeDraft('legacy', 1000) }, [
        'workflows/legacy.json'
      ])
      const originalDrafts = localStorage.getItem('Comfy.Workflow.Drafts')
      const originalOrder = localStorage.getItem('Comfy.Workflow.DraftOrder')

      const restoreStorage = installFaultStorage((key) =>
        key.startsWith('Comfy.Workflow.Draft.v2:')
          ? new DOMException('Storage blocked', 'SecurityError')
          : null
      )
      try {
        expect(migrateV1toV2(personalWorkspace)).toBe(-1)
        expect(localStorage.getItem('Comfy.Workflow.Drafts')).toBe(
          originalDrafts
        )
        expect(localStorage.getItem('Comfy.Workflow.DraftOrder')).toBe(
          originalOrder
        )
      } finally {
        restoreStorage()
      }
    })

    it('uses and removes the redundant legacy workflow singleton during quota retry', () => {
      const draft = makeDraft('large', 1000)
      setActualV1Data({ 'workflows/large.json': draft }, [
        'workflows/large.json'
      ])
      localStorage.setItem('workflow', draft.data)

      const restoreStorage = installFaultStorage((key) =>
        key.startsWith('Comfy.Workflow.Draft.v2:') &&
        localStorage.getItem('workflow') !== null
          ? new DOMException('Quota exceeded', 'QuotaExceededError')
          : null
      )
      try {
        expect(migrateV1toV2(personalWorkspace)).toBe(1)
        expect(
          getV2Payload(personalWorkspace, 'workflows/large.json')?.data
        ).toBe(draft.data)
        expect(localStorage.getItem('workflow')).toBeNull()
      } finally {
        restoreStorage()
      }
    })

    it('preserves a unique legacy workflow singleton', () => {
      setActualV1Data({ 'workflows/a.json': makeDraft('a', 1000) }, [
        'workflows/a.json'
      ])
      localStorage.setItem('workflow', '{"unique":true}')

      expect(migrateV1toV2(personalWorkspace)).toBe(1)
      expect(localStorage.getItem('workflow')).toBe('{"unique":true}')
    })
  })

  describe('V1 tab state migration', () => {
    it('migrates legacy tab state without overwriting a current V2 pointer', () => {
      setActualV1Data({ 'workflows/a.json': makeDraft('a', 1000) }, [
        'workflows/a.json'
      ])
      localStorage.setItem(
        'Comfy.OpenWorkflowsPaths',
        JSON.stringify(['workflows/a.json'])
      )
      localStorage.setItem('Comfy.ActiveWorkflowIndex', JSON.stringify(0))

      const clientId = 'client-123'
      writeOpenPaths(clientId, {
        workspaceId: personalWorkspace,
        paths: ['workflows/current.json'],
        activeIndex: 0
      })

      expect(migrateV1toV2(personalWorkspace, clientId)).toBe(1)
      expect(readOpenPaths(clientId, personalWorkspace)?.paths).toEqual([
        'workflows/current.json'
      ])
      expect(localStorage.getItem('Comfy.OpenWorkflowsPaths')).toBeNull()
    })

    it('leaves legacy tab state intact when the durable V2 pointer cannot be written', () => {
      setActualV1Data({ 'workflows/a.json': makeDraft('a', 1000) }, [
        'workflows/a.json'
      ])
      localStorage.setItem(
        'Comfy.OpenWorkflowsPaths',
        JSON.stringify(['workflows/a.json'])
      )
      localStorage.setItem('Comfy.ActiveWorkflowIndex', JSON.stringify(0))

      const restoreStorage = installFaultStorage((key) =>
        key === 'Comfy.Workflow.LastOpenPaths:personal'
          ? new DOMException('Quota exceeded', 'QuotaExceededError')
          : null
      )
      try {
        expect(migrateV1toV2(personalWorkspace, 'client-tab-fail')).toBe(1)
        expect(localStorage.getItem('Comfy.OpenWorkflowsPaths')).not.toBeNull()
        expect(localStorage.getItem('Comfy.ActiveWorkflowIndex')).not.toBeNull()
      } finally {
        restoreStorage()
      }
    })

    it('migrates legacy tab state when current V2 tab state is empty', () => {
      setActualV1Data(
        {
          'workflows/a.json': makeDraft('a', 1000),
          'workflows/b.json': makeDraft('b', 2000)
        },
        ['workflows/a.json', 'workflows/b.json']
      )
      localStorage.setItem(
        'Comfy.OpenWorkflowsPaths',
        JSON.stringify(['workflows/a.json', 'workflows/b.json'])
      )
      localStorage.setItem('Comfy.ActiveWorkflowIndex', JSON.stringify(1))

      const clientId = 'client-456'
      expect(migrateV1toV2(personalWorkspace, clientId)).toBe(2)
      expect(readOpenPaths(clientId, personalWorkspace)).toMatchObject({
        paths: ['workflows/a.json', 'workflows/b.json'],
        activeIndex: 1
      })
    })

    it('clamps an out-of-range legacy active index to the last migrated path', () => {
      setActualV1Data(
        {
          'workflows/a.json': makeDraft('a', 1000),
          'workflows/b.json': makeDraft('b', 2000)
        },
        ['workflows/a.json', 'workflows/b.json']
      )
      localStorage.setItem(
        'Comfy.OpenWorkflowsPaths',
        JSON.stringify(['workflows/a.json', 'workflows/b.json'])
      )
      localStorage.setItem('Comfy.ActiveWorkflowIndex', JSON.stringify(7))

      const clientId = 'client-clamp'
      expect(migrateV1toV2(personalWorkspace, clientId)).toBe(2)
      expect(readOpenPaths(clientId, personalWorkspace)).toMatchObject({
        paths: ['workflows/a.json', 'workflows/b.json'],
        activeIndex: 1
      })
    })
  })

  describe('cleanup and status', () => {
    it('cleans actual V1 keys only for the personal workspace', () => {
      setActualV1Data({ 'workflows/personal.json': makeDraft('personal', 1) }, [
        'workflows/personal.json'
      ])
      setScopedV1Data(
        teamWorkspace,
        { 'workflows/team.json': makeDraft('team', 1) },
        ['workflows/team.json']
      )

      cleanupV1Data(teamWorkspace)
      expect(localStorage.getItem('Comfy.Workflow.Drafts')).not.toBeNull()
      expect(
        localStorage.getItem(`Comfy.Workflow.Drafts:${teamWorkspace}`)
      ).toBeNull()

      cleanupV1Data(personalWorkspace)
      expect(localStorage.getItem('Comfy.Workflow.Drafts')).toBeNull()
    })

    it('reports actual unscoped V1 history', () => {
      setActualV1Data(
        {
          'workflows/a.json': makeDraft('a', 1),
          'workflows/b.json': makeDraft('b', 2)
        },
        ['workflows/a.json', 'workflows/b.json']
      )

      expect(getMigrationStatus(personalWorkspace)).toEqual({
        v1Exists: true,
        v2Exists: false,
        v1DraftCount: 2,
        v2DraftCount: 0
      })
    })
  })
})
