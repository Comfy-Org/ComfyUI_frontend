import { fromAny } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { bindCanvasTracker } from '@/platform/workflow/core/canvasTrackerOwnership'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'

import { useComfyApiStore } from '@/platform/nodeApi/v4/comfyApiStore'
import type { Comfy, DocumentHandle } from '@/platform/nodeApi/v4/types'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/scripts/api'))

function isLoaded(workflow: ComfyWorkflow): workflow is LoadedComfyWorkflow {
  return workflow.changeTracker !== null
}

function openWorkflow(name: string, extra: Record<string, unknown>) {
  const store = useWorkflowStore()
  const workflow = new ComfyWorkflow({
    path: `workflows/${name}.json`,
    modified: 0,
    size: 0
  })
  store.attachWorkflow(workflow)
  store.openWorkflowsInBackground({ right: [workflow.path] })
  const saved = { ...app.rootGraph.serialize(), extra }
  workflow.changeTracker = markRaw(new ChangeTracker(workflow, fromAny(saved)))
  assert(isLoaded(workflow))
  return workflow
}

function show(workflow: LoadedComfyWorkflow) {
  useWorkflowStore().activeWorkflow = workflow
  app.rootGraph.configure(fromAny(workflow.changeTracker.activeState))
  workflow.changeTracker.reset(fromAny(app.rootGraph.serialize()))
}

describe('workflow extra', () => {
  let comfy: Comfy
  let onScreen: LoadedComfyWorkflow
  let background: LoadedComfyWorkflow
  let document: DocumentHandle

  beforeEach(() => {
    ChangeTracker.resetCanvasTrackerForTest()
    ChangeTracker.isLoadingGraph = false
    app.rootGraph.clear()
    app.rootGraph.add(new LGraphNode('Node', 'TestNode'))
    app.canvas.graph = app.rootGraph
    background = openWorkflow('Background', { note: 'behind' })
    onScreen = openWorkflow('Shown', { note: 'saved' })
    show(onScreen)
    vi.mocked(app.loadGraphData).mockImplementation(async (state) => {
      assert(state)
      app.rootGraph.configure(fromAny(state))
      onScreen.changeTracker.reset(fromAny(app.rootGraph.serialize()))
      return true
    })
    delete window.comfy_v4
    useComfyApiStore().publish()
    assert(window.comfy_v4)
    comfy = window.comfy_v4
    const current = comfy.workflow.current()
    assert(current)
    document = current
  })

  function backgroundDocument(): DocumentHandle {
    show(background)
    const handle = comfy.workflow.current()
    show(onScreen)
    assert(handle)
    return handle
  }

  describe('getExtra', () => {
    it('reads the live extra of the document on screen as a frozen copy', () => {
      app.rootGraph.extra.note = { lines: ['live'] }

      const note = comfy.workflow.getExtra(document, 'note')

      expect(note).toEqual({ lines: ['live'] })
      expect(note).not.toBe(app.rootGraph.extra.note)
      expect(Object.isFrozen(note)).toBe(true)
      expect(Object.isFrozen(Reflect.get(Object(note), 'lines'))).toBe(true)
    })

    it('reads the root graph while the user is inside a subgraph', () => {
      const subgraph = createTestSubgraph({ rootGraph: app.rootGraph })
      subgraph.extra.note = 'inner'
      app.canvas.graph = subgraph

      expect(comfy.workflow.getExtra(document, 'note')).toBe('saved')
    })

    it('reads a background document from the state its change tracker saves', () => {
      app.rootGraph.extra.note = 'canvas'

      expect(comfy.workflow.getExtra(backgroundDocument(), 'note')).toBe(
        'behind'
      )
    })

    it('reads the saved state while the canvas belongs to another tracker', () => {
      app.rootGraph.extra.note = 'canvas'

      bindCanvasTracker(background.changeTracker)

      expect(comfy.workflow.getExtra(document, 'note')).toBe('saved')
    })

    it('reads the saved state while the host loads a graph', () => {
      app.rootGraph.extra.note = 'canvas'

      ChangeTracker.isLoadingGraph = true

      expect(comfy.workflow.getExtra(document, 'note')).toBe('saved')
    })

    it('is undefined for a key the document does not have, inherited ones included', () => {
      expect(comfy.workflow.getExtra(document, 'missing')).toBeUndefined()
      expect(comfy.workflow.getExtra(document, 'toString')).toBeUndefined()
      expect(comfy.workflow.getExtra(document, '__proto__')).toBeUndefined()
    })

    it('is undefined for a closed document and for no document', async () => {
      const closed = backgroundDocument()
      expect(comfy.workflow.getExtra(closed, 'note')).toBe('behind')

      await useWorkflowStore().closeWorkflow(background)

      expect(comfy.workflow.getExtra(closed, 'note')).toBeUndefined()
      expect(comfy.workflow.getExtra(undefined, 'note')).toBeUndefined()
    })

    it('is undefined for a value the workflow cannot save', () => {
      app.rootGraph.extra.note = 1n

      expect(comfy.workflow.getExtra(document, 'note')).toBeUndefined()
    })

    it('refuses a key that is not a string, even with no document', () => {
      expect(() =>
        Reflect.apply(comfy.workflow.getExtra, comfy.workflow, [undefined, 1])
      ).toThrow('workflow.getExtra needs a key, not 1.')
    })

    it('refuses a value that is not a document handle', () => {
      expect(() =>
        Reflect.apply(comfy.workflow.getExtra, comfy.workflow, [
          { ...document },
          'note'
        ])
      ).toThrow(TypeError)
      expect(() =>
        Reflect.apply(comfy.workflow.getExtra, comfy.workflow, [
          document.id,
          'note'
        ])
      ).toThrow('workflow.getExtra needs a document handle or undefined')
    })
  })

  describe('setExtra', () => {
    const tracker = () => onScreen.changeTracker

    it('writes a copy into the document on screen as one undo step that marks it modified', () => {
      const note = { lines: ['drawn'] }

      expect(comfy.workflow.setExtra(document, 'note', note)).toBe(true)
      note.lines.push('later')

      expect(app.rootGraph.extra.note).toEqual({ lines: ['drawn'] })
      expect(tracker().activeState.extra?.note).toEqual({ lines: ['drawn'] })
      expect(tracker().undoQueue).toHaveLength(1)
      expect(onScreen.isModified).toBe(true)
      expect(comfy.workflow.getExtra(document, 'note')).toEqual({
        lines: ['drawn']
      })
    })

    it('is reversed by undo and repeated by redo', async () => {
      comfy.workflow.setExtra(document, 'note', 'drawn')

      await tracker().undo()
      expect(comfy.workflow.getExtra(document, 'note')).toBe('saved')
      expect(onScreen.isModified).toBe(false)

      await tracker().redo()
      expect(comfy.workflow.getExtra(document, 'note')).toBe('drawn')
    })

    it('deletes the key for undefined, as one undo step that undo puts back', async () => {
      expect(comfy.workflow.setExtra(document, 'note', undefined)).toBe(true)

      expect(Object.hasOwn(app.rootGraph.extra, 'note')).toBe(false)
      expect(tracker().undoQueue).toHaveLength(1)

      await tracker().undo()
      expect(comfy.workflow.getExtra(document, 'note')).toBe('saved')
    })

    it('joins a batch with a node edit as one undo step', () => {
      const [node] = comfy.graph.root()?.nodes() ?? []
      assert(node)

      comfy.graph.batch(() => {
        comfy.workflow.setExtra(document, 'note', 'batched')
        node.setTitle('Batched')
      })

      expect(tracker().undoQueue).toHaveLength(1)
      expect(tracker().activeState.extra?.note).toBe('batched')
    })

    it('adds no undo step for a write that changes nothing', () => {
      expect(comfy.workflow.setExtra(document, 'note', 'saved')).toBe(true)

      expect(tracker().undoQueue).toHaveLength(0)
    })

    it('writes nothing to a background document, while the same write reaches the one on screen', () => {
      const behind = backgroundDocument()

      expect(comfy.workflow.setExtra(behind, 'note', 'drawn')).toBe(false)
      expect(app.rootGraph.extra.note).toBe('saved')
      expect(background.changeTracker.activeState.extra?.note).toBe('behind')
      expect(tracker().undoQueue).toHaveLength(0)

      expect(comfy.workflow.setExtra(document, 'note', 'drawn')).toBe(true)
      expect(app.rootGraph.extra.note).toBe('drawn')
    })

    it('writes nothing while the canvas belongs to another tracker or the host loads a graph', () => {
      bindCanvasTracker(background.changeTracker)
      expect(comfy.workflow.setExtra(document, 'note', 'drawn')).toBe(false)

      ChangeTracker.resetCanvasTrackerForTest()
      ChangeTracker.isLoadingGraph = true
      expect(comfy.workflow.setExtra(document, 'note', 'drawn')).toBe(false)
      expect(app.rootGraph.extra.note).toBe('saved')

      ChangeTracker.isLoadingGraph = false
      expect(comfy.workflow.setExtra(document, 'note', 'drawn')).toBe(true)
      expect(app.rootGraph.extra.note).toBe('drawn')
    })

    it('writes nothing to a closed document or to no document', async () => {
      expect(comfy.workflow.setExtra(document, 'note', 'open')).toBe(true)

      await useWorkflowStore().closeWorkflow(onScreen)

      expect(comfy.workflow.setExtra(document, 'note', 'closed')).toBe(false)
      expect(comfy.workflow.setExtra(undefined, 'note', 'none')).toBe(false)
      expect(app.rootGraph.extra.note).toBe('open')
    })

    it.for([
      ['a key that is not a string', [1, 'x'], 'needs a key, not 1.'],
      ['the key __proto__', ['__proto__', {}], "needs a key, not '__proto__'."],
      [
        'a value the workflow cannot save',
        ['note', 1n],
        'needs a value as a string, a finite number'
      ]
    ] as const)('refuses %s and changes nothing', ([, args, message]) => {
      expect(() =>
        Reflect.apply(comfy.workflow.setExtra, comfy.workflow, [
          document,
          ...args
        ])
      ).toThrow(`workflow.setExtra ${message}`)

      expect(app.rootGraph.extra.note).toBe('saved')
      expect(Object.getPrototypeOf(app.rootGraph.extra)).toBe(Object.prototype)
      expect(tracker().undoQueue).toHaveLength(0)
    })

    it('refuses a value that is not a document handle before writing', () => {
      expect(() =>
        Reflect.apply(comfy.workflow.setExtra, comfy.workflow, [
          { ...document },
          'note',
          'drawn'
        ])
      ).toThrow('workflow.setExtra needs a document handle or undefined')

      expect(app.rootGraph.extra.note).toBe('saved')
    })
  })
})
