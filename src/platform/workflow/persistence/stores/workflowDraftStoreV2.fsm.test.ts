import * as fc from 'fast-check'
import type { Command } from 'fast-check'

import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_DRAFTS } from '../base/draftTypes'
import { useWorkflowDraftStoreV2 } from './workflowDraftStoreV2'

vi.mock('@/scripts/api', () => ({
  api: {
    clientId: 'test-client',
    initialClientId: 'test-client'
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    loadGraphData: vi.fn().mockResolvedValue(undefined)
  }
}))

// ── Model & Real ────────────────────────────────────────────────────

interface DraftData {
  data: string
  name: string
  isTemporary: boolean
}

interface PersistenceModel {
  drafts: Map<string, DraftData>
  lruOrder: string[] // paths, oldest→newest
}

interface PersistenceReal {
  draftStore: ReturnType<typeof useWorkflowDraftStoreV2>
}

// ── Invariant Helpers ───────────────────────────────────────────────

function assertIndexPayloadConsistency() {
  const indexJson = localStorage.getItem(
    'Comfy.Workflow.DraftIndex.v2:personal'
  )
  if (!indexJson) return

  const index = JSON.parse(indexJson)
  const prefix = 'Comfy.Workflow.Draft.v2:personal:'

  for (const key of index.order) {
    const payloadJson = localStorage.getItem(`${prefix}${key}`)
    expect(payloadJson, `Missing payload for index key ${key}`).not.toBeNull()
  }

  for (let i = 0; i < localStorage.length; i++) {
    const lsKey = localStorage.key(i)!
    if (lsKey.startsWith(prefix)) {
      const draftKey = lsKey.slice(prefix.length)
      expect(index.order, `Orphan payload ${draftKey}`).toContain(draftKey)
    }
  }

  expect(new Set(index.order).size).toBe(index.order.length)
  expect(index.order.length).toBeLessThanOrEqual(MAX_DRAFTS)
}

function assertModelMatchesReal(
  model: PersistenceModel,
  real: PersistenceReal
) {
  for (const [path, expected] of model.drafts) {
    const draft = real.draftStore.getDraft(path)
    expect(draft, `Draft missing for ${path}`).not.toBeNull()
    expect(draft!.data).toBe(expected.data)
    expect(draft!.name).toBe(expected.name)
    expect(draft!.isTemporary).toBe(expected.isTemporary)
  }

  const indexJson = localStorage.getItem(
    'Comfy.Workflow.DraftIndex.v2:personal'
  )
  if (model.drafts.size === 0) {
    if (!indexJson) return
    const index = JSON.parse(indexJson)
    expect(Object.keys(index.entries)).toHaveLength(0)
    return
  }
  const index = JSON.parse(indexJson!)
  expect(Object.keys(index.entries)).toHaveLength(model.drafts.size)

  // Reverse check: every real store entry exists in the model
  for (const entry of Object.values(index.entries) as { path: string }[]) {
    expect(
      model.drafts.has(entry.path),
      `Real store has extra entry ${entry.path} not in model`
    ).toBe(true)
  }
}

// ── Commands ────────────────────────────────────────────────────────

class SaveDraftCommand implements Command<PersistenceModel, PersistenceReal> {
  constructor(
    readonly path: string,
    readonly data: string,
    readonly name: string,
    readonly isTemporary: boolean
  ) {}

  check() {
    return true
  }

  run(model: PersistenceModel, real: PersistenceReal) {
    const result = real.draftStore.saveDraft(this.path, this.data, {
      name: this.name,
      isTemporary: this.isTemporary
    })
    expect(result).toBe(true)

    model.drafts.set(this.path, {
      data: this.data,
      name: this.name,
      isTemporary: this.isTemporary
    })
    model.lruOrder = model.lruOrder.filter((p) => p !== this.path)
    model.lruOrder.push(this.path)

    while (model.lruOrder.length > MAX_DRAFTS) {
      const evicted = model.lruOrder.shift()!
      model.drafts.delete(evicted)
    }

    assertIndexPayloadConsistency()
    assertModelMatchesReal(model, real)
  }

  toString() {
    return `SaveDraft(${this.path}, temp=${this.isTemporary})`
  }
}

class GetDraftCommand implements Command<PersistenceModel, PersistenceReal> {
  constructor(readonly path: string) {}

  check() {
    return true
  }

  run(model: PersistenceModel, real: PersistenceReal) {
    const draft = real.draftStore.getDraft(this.path)
    const expected = model.drafts.get(this.path)

    if (expected) {
      expect(draft).not.toBeNull()
      expect(draft!.data).toBe(expected.data)
      expect(draft!.name).toBe(expected.name)
      expect(draft!.isTemporary).toBe(expected.isTemporary)
    } else {
      expect(draft).toBeNull()
    }
  }

  toString() {
    return `GetDraft(${this.path})`
  }
}

class RemoveDraftCommand implements Command<PersistenceModel, PersistenceReal> {
  constructor(readonly path: string) {}

  check(model: Readonly<PersistenceModel>) {
    return model.drafts.has(this.path)
  }

  run(model: PersistenceModel, real: PersistenceReal) {
    real.draftStore.removeDraft(this.path)
    model.drafts.delete(this.path)
    model.lruOrder = model.lruOrder.filter((p) => p !== this.path)

    assertIndexPayloadConsistency()
    assertModelMatchesReal(model, real)
  }

  toString() {
    return `RemoveDraft(${this.path})`
  }
}

class MoveDraftCommand implements Command<PersistenceModel, PersistenceReal> {
  constructor(
    readonly oldPath: string,
    readonly newPath: string,
    readonly newName: string
  ) {}

  check(model: Readonly<PersistenceModel>) {
    return (
      this.oldPath !== this.newPath &&
      model.drafts.has(this.oldPath) &&
      !model.drafts.has(this.newPath)
    )
  }

  run(model: PersistenceModel, real: PersistenceReal) {
    const existing = model.drafts.get(this.oldPath)!

    real.draftStore.moveDraft(this.oldPath, this.newPath, this.newName)

    model.drafts.delete(this.oldPath)
    model.drafts.set(this.newPath, {
      ...existing,
      name: this.newName
    })
    model.lruOrder = model.lruOrder.filter((p) => p !== this.oldPath)
    model.lruOrder.push(this.newPath)

    assertIndexPayloadConsistency()
    assertModelMatchesReal(model, real)
  }

  toString() {
    return `MoveDraft(${this.oldPath} -> ${this.newPath})`
  }
}

class GetMostRecentPathCommand implements Command<
  PersistenceModel,
  PersistenceReal
> {
  check() {
    return true
  }

  run(model: PersistenceModel, real: PersistenceReal) {
    const result = real.draftStore.getMostRecentPath()
    const expected =
      model.lruOrder.length > 0
        ? model.lruOrder[model.lruOrder.length - 1]
        : null
    expect(result).toBe(expected)
  }

  toString() {
    return 'GetMostRecentPath()'
  }
}

class ResetCommand implements Command<PersistenceModel, PersistenceReal> {
  check() {
    return true
  }

  run(model: PersistenceModel, real: PersistenceReal) {
    // Simulate page reload: new Pinia + new store, but storage persists
    setActivePinia(createTestingPinia({ stubActions: false }))
    real.draftStore = useWorkflowDraftStoreV2()

    for (const [path, expected] of model.drafts) {
      const draft = real.draftStore.getDraft(path)
      expect(draft, `Draft lost after reset: ${path}`).not.toBeNull()
      expect(draft!.data).toBe(expected.data)
      expect(draft!.name).toBe(expected.name)
      expect(draft!.isTemporary).toBe(expected.isTemporary)
    }
    assertIndexPayloadConsistency()
  }

  toString() {
    return 'Reset()'
  }
}

class StoreResetCommand implements Command<PersistenceModel, PersistenceReal> {
  check() {
    return true
  }

  run(model: PersistenceModel, real: PersistenceReal) {
    // Call reset() directly to clear in-memory cache without recreating Pinia.
    // This exercises the orphan cleanup path in loadIndex() on next access.
    real.draftStore.reset()

    for (const [path, expected] of model.drafts) {
      const draft = real.draftStore.getDraft(path)
      expect(draft, `Draft lost after store reset: ${path}`).not.toBeNull()
      expect(draft!.data).toBe(expected.data)
      expect(draft!.name).toBe(expected.name)
      expect(draft!.isTemporary).toBe(expected.isTemporary)
    }
    assertIndexPayloadConsistency()
  }

  toString() {
    return 'StoreReset()'
  }
}

// ── Test Suite ──────────────────────────────────────────────────────

describe('workflowDraftStoreV2 FSM', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  // 33+ unique paths to exceed MAX_DRAFTS (32) and exercise LRU eviction
  const pathPool = fc.constantFrom(
    ...Array.from({ length: 35 }, (_, i) => `workflows/${i}.json`)
  )

  const dataPool = fc.constantFrom(
    '{"nodes":[]}',
    '{"nodes":[1]}',
    '{"nodes":[1,2]}',
    '{"version":1}',
    '{"version":2}'
  )

  const namePool = fc.constantFrom('wf-1', 'wf-2', 'wf-3', 'wf-4')

  const allCommands = [
    pathPool.chain((path) =>
      fc
        .tuple(dataPool, namePool, fc.boolean())
        .map(
          ([data, name, isTemp]) =>
            new SaveDraftCommand(path, data, name, isTemp)
        )
    ),
    pathPool.map((path) => new GetDraftCommand(path)),
    pathPool.map((path) => new RemoveDraftCommand(path)),
    fc
      .tuple(pathPool, pathPool, namePool)
      .map(([old, nw, name]) => new MoveDraftCommand(old, nw, name)),
    fc.constant(new GetMostRecentPathCommand()),
    fc.constant(new ResetCommand()),
    fc.constant(new StoreResetCommand())
  ]

  it(
    'maintains all invariants across random command sequences',
    { timeout: 30_000 },
    () => {
      fc.assert(
        fc.property(fc.commands(allCommands, { size: 'medium' }), (cmds) => {
          // Clear storage between each fast-check run
          localStorage.clear()
          sessionStorage.clear()
          setActivePinia(createTestingPinia({ stubActions: false }))

          const model: PersistenceModel = {
            drafts: new Map(),
            lruOrder: []
          }
          const real: PersistenceReal = {
            draftStore: useWorkflowDraftStoreV2()
          }
          fc.modelRun(() => ({ model, real }), cmds)
        }),
        { numRuns: 50 }
      )
    }
  )
})
