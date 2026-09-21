import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { blankGraph } from '@/scripts/defaultGraph'

import { useAgentWorkflowTabBindingStore } from './agentWorkflowTabBindingStore'

const LEGACY_KEY = 'Comfy.Agent.WorkflowTabBindings'
const STORAGE_KEY = 'Comfy.Agent.WorkflowTabBindings.v2'
const DEFAULT_PATH = 'workflows/Unsaved Workflow.json'
const SUFFIXED_PATH = 'workflows/Unsaved Workflow (2).json'
const DRAFT_GRAPH_ID = '3d4d7f1e-3c8b-4a0a-9a3c-1d2e3f4a5b6c'
const OTHER_GRAPH_ID = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const DAY_MS = 24 * 60 * 60 * 1000

interface PersistedBinding {
  tabPath: string
  graphId: string | null
  confirmedAt: number
}

function seedBindings(records: Record<string, PersistedBinding>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function storedBindings(): unknown {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
}

describe('agentWorkflowTabBindingStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it.for(['before', 'after'])(
    'reconnects a restored draft when bindings initialize %s tab restoration',
    async (timing) => {
      const path = 'workflows/Agent draft.json'
      seedBindings({
        'wf-minted': {
          tabPath: path,
          graphId: DRAFT_GRAPH_ID,
          confirmedAt: Date.now()
        }
      })
      const workflows = useWorkflowStore()
      if (timing === 'before') useAgentWorkflowTabBindingStore()
      const restored = workflows.createTemporary('Agent draft.json', {
        ...blankGraph,
        id: DRAFT_GRAPH_ID
      })
      workflows.openWorkflowsInBackground({ right: [restored.path] })
      const bindings = useAgentWorkflowTabBindingStore()
      await nextTick()

      expect(bindings.tabPathFor('wf-minted')).toBe(restored.path)
      expect(bindings.matchesWorkflow('wf-minted', restored)).toBe(true)

      await workflows.closeWorkflow(restored)
      const replacement = workflows.createTemporary('Agent draft.json')
      workflows.openWorkflowsInBackground({ right: [replacement.path] })
      await nextTick()

      expect(replacement.path).toBe(restored.path)
      expect(bindings.workflowIdFor(replacement.path)).toBeUndefined()
      expect(bindings.matchesWorkflow('wf-minted', replacement)).toBe(false)
    }
  )

  // A browser tab closed without the SPA's own cleanup never calls unbind(),
  // so its record reaches the next page load exactly like a restored draft's:
  // same store-before-tab ordering, same reused default path. Only the
  // document identity tells the two apart, and a legacy record has none.
  it('does not treat an abandoned tab binding as a restored draft', async () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({ 'wf-abandoned': DEFAULT_PATH })
    )
    const workflows = useWorkflowStore()
    useAgentWorkflowTabBindingStore()
    const fresh = workflows.createTemporary()
    workflows.openWorkflowsInBackground({ right: [fresh.path] })
    const bindings = useAgentWorkflowTabBindingStore()
    await nextTick()

    expect(fresh.path).toBe(DEFAULT_PATH)
    expect(bindings.matchesWorkflow('wf-abandoned', fresh)).toBe(false)
    expect(bindings.tabPathFor('wf-abandoned')).toBeUndefined()
  })

  it('resolves a binding by document identity, not by path', async () => {
    seedBindings({
      'wf-abandoned': {
        tabPath: DEFAULT_PATH,
        graphId: DRAFT_GRAPH_ID,
        confirmedAt: Date.now()
      }
    })
    const workflows = useWorkflowStore()
    const bindings = useAgentWorkflowTabBindingStore()
    const fresh = workflows.createTemporary()
    workflows.openWorkflowsInBackground({ right: [fresh.path] })
    await nextTick()

    expect(fresh.path).toBe(DEFAULT_PATH)
    expect(bindings.matchesWorkflow('wf-abandoned', fresh)).toBe(false)
    expect(bindings.tabPathFor('wf-abandoned')).toBeUndefined()
    expect(bindings.workflowIdFor(DEFAULT_PATH)).toBeUndefined()

    await workflows.closeWorkflow(fresh)
    const restored = workflows.createTemporary('Unsaved Workflow.json', {
      ...blankGraph,
      id: DRAFT_GRAPH_ID
    })
    workflows.openWorkflowsInBackground({ right: [restored.path] })
    await nextTick()

    expect(restored.path).toBe(DEFAULT_PATH)
    expect(bindings.tabPathFor('wf-abandoned')).toBe(DEFAULT_PATH)
    expect(bindings.workflowIdFor(DEFAULT_PATH)).toBe('wf-abandoned')
    expect(bindings.matchesWorkflow('wf-abandoned', restored)).toBe(true)
  })

  it('keeps a refused legacy binding for its owner when the unverified occupant closes', async () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({ 'wf-abandoned': DEFAULT_PATH })
    )
    const workflows = useWorkflowStore()
    const bindings = useAgentWorkflowTabBindingStore()
    const occupant = workflows.createTemporary()
    workflows.openWorkflowsInBackground({ right: [occupant.path] })
    await nextTick()

    await workflows.closeWorkflow(occupant)
    await nextTick()

    expect(bindings.tabPathFor('wf-abandoned')).toBe(DEFAULT_PATH)
    expect(storedBindings()).toEqual({
      'wf-abandoned': {
        tabPath: DEFAULT_PATH,
        graphId: null,
        confirmedAt: expect.any(Number)
      }
    })
  })

  it('does not hand a refused draft the binding when it is saved in place at its path', async () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({ 'wf-abandoned': DEFAULT_PATH })
    )
    const workflows = useWorkflowStore()
    const bindings = useAgentWorkflowTabBindingStore()
    const fresh = workflows.createTemporary()
    workflows.openWorkflowsInBackground({ right: [fresh.path] })
    await nextTick()

    fresh.size = 1
    expect(fresh.isTemporary).toBe(false)

    expect(bindings.tabPathFor('wf-abandoned')).toBeUndefined()
    expect(bindings.workflowIdFor(DEFAULT_PATH)).toBeUndefined()
  })

  it('adopts two restored drafts that share a base name independently', async () => {
    seedBindings({
      'wf-first': {
        tabPath: DEFAULT_PATH,
        graphId: DRAFT_GRAPH_ID,
        confirmedAt: Date.now()
      },
      'wf-second': {
        tabPath: SUFFIXED_PATH,
        graphId: OTHER_GRAPH_ID,
        confirmedAt: Date.now()
      }
    })
    const workflows = useWorkflowStore()
    const bindings = useAgentWorkflowTabBindingStore()
    const first = workflows.createTemporary('Unsaved Workflow.json', {
      ...blankGraph,
      id: DRAFT_GRAPH_ID
    })
    const second = workflows.createTemporary('Unsaved Workflow (2).json', {
      ...blankGraph,
      id: OTHER_GRAPH_ID
    })
    workflows.openWorkflowsInBackground({ right: [first.path, second.path] })
    await nextTick()

    expect([first.path, second.path]).toEqual([DEFAULT_PATH, SUFFIXED_PATH])
    expect([
      bindings.tabPathFor('wf-first'),
      bindings.tabPathFor('wf-second')
    ]).toEqual([DEFAULT_PATH, SUFFIXED_PATH])
    expect(bindings.matchesWorkflow('wf-first', first)).toBe(true)
    expect(bindings.matchesWorkflow('wf-second', second)).toBe(true)
  })

  it('refuses both bindings when a blank tab shifts a restored draft to a new suffix', async () => {
    seedBindings({
      'wf-first': {
        tabPath: DEFAULT_PATH,
        graphId: DRAFT_GRAPH_ID,
        confirmedAt: Date.now()
      },
      'wf-second': {
        tabPath: SUFFIXED_PATH,
        graphId: OTHER_GRAPH_ID,
        confirmedAt: Date.now()
      }
    })
    const workflows = useWorkflowStore()
    const bindings = useAgentWorkflowTabBindingStore()
    const blank = workflows.createTemporary()
    const shifted = workflows.createTemporary('Unsaved Workflow.json', {
      ...blankGraph,
      id: DRAFT_GRAPH_ID
    })
    workflows.openWorkflowsInBackground({ right: [blank.path, shifted.path] })
    await nextTick()

    expect([blank.path, shifted.path]).toEqual([DEFAULT_PATH, SUFFIXED_PATH])
    expect([
      bindings.tabPathFor('wf-first'),
      bindings.tabPathFor('wf-second')
    ]).toEqual([undefined, undefined])
    expect(bindings.matchesWorkflow('wf-first', blank)).toBe(false)
    expect(bindings.matchesWorkflow('wf-second', shifted)).toBe(false)

    await workflows.closeWorkflow(blank)
    await nextTick()

    expect([
      bindings.tabPathFor('wf-first'),
      bindings.tabPathFor('wf-second')
    ]).toEqual([DEFAULT_PATH, undefined])
  })

  it('releases a closed temporary tab binding before its path is reused', async () => {
    const workflows = useWorkflowStore()
    const first = workflows.createTemporary()
    workflows.openWorkflowsInBackground({ right: [first.path] })
    const bindings = useAgentWorkflowTabBindingStore()
    bindings.bind('wf-first', first.path)
    expect(bindings.matchesWorkflow('wf-first', first)).toBe(true)
    await workflows.closeWorkflow(first)
    const replacement = workflows.createTemporary()
    expect(replacement.path).toBe(first.path)
    expect(bindings.tabPathFor('wf-first')).toBeUndefined()
    expect(bindings.workflowIdFor(replacement.path)).toBeUndefined()
    expect(bindings.matchesWorkflow('wf-first', replacement)).toBe(false)
  })

  it('prunes bindings not confirmed within the TTL at store creation', () => {
    seedBindings({
      'wf-expired': {
        tabPath: 'workflows/a.json',
        graphId: null,
        confirmedAt: Date.now() - 31 * DAY_MS
      },
      'wf-kept': {
        tabPath: 'workflows/b.json',
        graphId: null,
        confirmedAt: Date.now() - 29 * DAY_MS
      }
    })

    const bindings = useAgentWorkflowTabBindingStore()

    expect(bindings.tabPathFor('wf-expired')).toBeUndefined()
    expect(bindings.tabPathFor('wf-kept')).toBe('workflows/b.json')
  })

  it('migrates a legacy binding for a saved workflow to the v2 key and leaves the legacy key in place', async () => {
    const path = 'workflows/saved.json'
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ 'wf-saved': path }))
    const workflows = useWorkflowStore()
    const saved = new ComfyWorkflow({ path, modified: 1, size: 1 })
    workflows.attachWorkflow(saved, 0)

    const bindings = useAgentWorkflowTabBindingStore()
    await nextTick()

    expect(bindings.tabPathFor('wf-saved')).toBe(path)
    expect(bindings.matchesWorkflow('wf-saved', saved)).toBe(true)
    expect(storedBindings()).toEqual({
      'wf-saved': {
        tabPath: path,
        graphId: null,
        confirmedAt: expect.any(Number)
      }
    })
    expect(localStorage.getItem(LEGACY_KEY)).toBe(
      JSON.stringify({ 'wf-saved': path })
    )
  })

  it('starts empty when the legacy key does not hold JSON', async () => {
    localStorage.setItem(LEGACY_KEY, '{not json')
    const path = 'workflows/saved.json'
    const workflows = useWorkflowStore()
    workflows.attachWorkflow(
      new ComfyWorkflow({ path, modified: 1, size: 1 }),
      0
    )

    const bindings = useAgentWorkflowTabBindingStore()
    await nextTick()

    expect(bindings.workflowIdFor(path)).toBeUndefined()
    expect(storedBindings()).toEqual({})
  })

  it('lets a saved tab whose stored content is not JSON claim its binding', async () => {
    const path = 'workflows/saved.json'
    seedBindings({
      'wf-saved': {
        tabPath: path,
        graphId: DRAFT_GRAPH_ID,
        confirmedAt: Date.now()
      }
    })
    const workflows = useWorkflowStore()
    const saved = new ComfyWorkflow({ path, modified: 1, size: 1 })
    saved.originalContent = '{not json'
    workflows.attachWorkflow(saved, 0)

    const bindings = useAgentWorkflowTabBindingStore()
    await nextTick()

    expect(bindings.tabPathFor('wf-saved')).toBe(path)
    expect(bindings.matchesWorkflow('wf-saved', saved)).toBe(true)
  })

  it('bind records the tab graph id and a fresh confirmedAt', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const workflows = useWorkflowStore()
    const tab = workflows.createTemporary('Agent draft.json', {
      ...blankGraph,
      id: DRAFT_GRAPH_ID
    })
    workflows.openWorkflowsInBackground({ right: [tab.path] })

    useAgentWorkflowTabBindingStore().bind('wf-1', tab.path)
    await nextTick()

    expect(storedBindings()).toEqual({
      'wf-1': {
        tabPath: tab.path,
        graphId: DRAFT_GRAPH_ID,
        confirmedAt: Date.now()
      }
    })
  })

  it('re-stamps confirmedAt on a verified adoption', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const path = 'workflows/Agent draft.json'
    seedBindings({
      'wf-minted': {
        tabPath: path,
        graphId: DRAFT_GRAPH_ID,
        confirmedAt: Date.now() - 10 * DAY_MS
      }
    })
    const workflows = useWorkflowStore()
    const restored = workflows.createTemporary('Agent draft.json', {
      ...blankGraph,
      id: DRAFT_GRAPH_ID
    })
    workflows.openWorkflowsInBackground({ right: [restored.path] })

    useAgentWorkflowTabBindingStore()
    await nextTick()

    expect(storedBindings()).toEqual({
      'wf-minted': {
        tabPath: path,
        graphId: DRAFT_GRAPH_ID,
        confirmedAt: Date.now()
      }
    })
  })

  it('resolves both directions after a bind', () => {
    const store = useAgentWorkflowTabBindingStore()
    store.bind('wf-1', 'workflows/a.json')
    expect(store.tabPathFor('wf-1')).toBe('workflows/a.json')
    expect(store.workflowIdFor('workflows/a.json')).toBe('wf-1')
  })

  it('rebinding a workflow to a new tab releases the old tab', () => {
    const store = useAgentWorkflowTabBindingStore()
    store.bind('wf-1', 'workflows/a.json')
    store.bind('wf-1', 'workflows/b.json')
    expect(store.tabPathFor('wf-1')).toBe('workflows/b.json')
    expect(store.workflowIdFor('workflows/a.json')).toBeUndefined()
    expect(store.workflowIdFor('workflows/b.json')).toBe('wf-1')
  })

  it('binding another workflow to an occupied tab steals it', () => {
    const store = useAgentWorkflowTabBindingStore()
    store.bind('wf-1', 'workflows/a.json')
    store.bind('wf-2', 'workflows/a.json')
    expect(store.workflowIdFor('workflows/a.json')).toBe('wf-2')
    expect(store.tabPathFor('wf-1')).toBeUndefined()
    expect(store.tabPathFor('wf-2')).toBe('workflows/a.json')
  })

  it('T-18 / PM-664 / FE-1290 keeps sidebar context bound to the active workflow across reload', async () => {
    useAgentWorkflowTabBindingStore().bind('wf-1', 'workflows/a.json')
    await nextTick()
    useAgentWorkflowTabBindingStore().$dispose()

    const reloaded = useAgentWorkflowTabBindingStore()

    expect(reloaded.tabPathFor('wf-1')).toBe('workflows/a.json')
    expect(reloaded.workflowIdFor('workflows/a.json')).toBe('wf-1')
  })

  it('does not resolve prototype-inherited names as bindings', () => {
    const store = useAgentWorkflowTabBindingStore()
    expect(store.tabPathFor('constructor')).toBeUndefined()
    expect(store.workflowIdFor('workflows/missing.json')).toBeUndefined()
  })
})
