import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw, reactive } from 'vue'

import {
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { useComfyApiStore } from '@/platform/nodeApi/v4/comfyApiStore'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/scripts/api'))

describe('edits through the real change tracker', () => {
  let comfy: Comfy
  let tracker: ChangeTracker
  let workflow: { isModified: boolean }
  let source: LGraphNode
  let target: LGraphNode

  beforeEach(() => {
    ChangeTracker.resetCanvasTrackerForTest()
    ChangeTracker.isLoadingGraph = false
    const graph = app.rootGraph
    graph.clear()
    source = new LGraphNode('Source', 'TestNode')
    source.addOutput('out', 'INT')
    target = new LGraphNode('Target', 'TestNode')
    target.addInput('in', 'INT')
    graph.add(source)
    graph.add(target)
    app.canvas.graph = graph
    tracker = markRaw(
      new ChangeTracker(
        fromPartial({ path: '/edits.json' }),
        JSON.parse(JSON.stringify(graph.serialize()))
      )
    )
    workflow = reactive({ isModified: false })
    vi.mocked(useWorkflowStore().getWorkflowByPath).mockReturnValue(
      fromPartial(workflow)
    )
    useWorkflowStore().activeWorkflow = fromPartial({ changeTracker: tracker })
    vi.mocked(app.loadGraphData).mockImplementation(async (state) => {
      assert(state)
      app.rootGraph.configure(fromAny(state))
      tracker.reset(fromAny(app.rootGraph.serialize()))
      return true
    })
    delete window.comfy_v4
    useComfyApiStore().publish()
    assert(window.comfy_v4)
    comfy = window.comfy_v4
  })

  function handleOf(node: LGraphNode): NodeHandle {
    const handle = comfy.graph.node(String(node.id))
    assert(handle)
    return handle
  }

  function titleNow(node: LGraphNode) {
    return app.rootGraph.getNodeById(node.id)?.title
  }

  it('makes a node edit one undo step that undo reverses and redo repeats, and marks the workflow modified', async () => {
    handleOf(source).setTitle('Edited')

    expect(tracker.undoQueue).toHaveLength(1)
    expect(workflow.isModified).toBe(true)

    await tracker.undo()
    expect(titleNow(source)).toBe('Source')
    expect(workflow.isModified).toBe(false)

    await tracker.redo()
    expect(titleNow(source)).toBe('Edited')
    expect(workflow.isModified).toBe(true)
  })

  it('makes deleting a property one undo step that undo puts back and redo deletes again', async () => {
    handleOf(source).setProperty('stamp', 3)
    handleOf(source).setProperty('stamp', undefined)

    expect(tracker.undoQueue).toHaveLength(2)
    expect(app.rootGraph.getNodeById(source.id)?.properties).toEqual({})

    await tracker.undo()
    expect(app.rootGraph.getNodeById(source.id)?.properties).toEqual({
      stamp: 3
    })

    await tracker.redo()
    expect(app.rootGraph.getNodeById(source.id)?.properties).toEqual({})
  })

  it('makes a batch of edits one undo step, even when the host asks for a capture inside it', async () => {
    comfy.edit.batch(() => {
      handleOf(source).setTitle('One')
      tracker.captureCanvasState()
      handleOf(target).setTitle('Two')
      handleOf(source).setColor('#123')
    })

    expect(tracker.undoQueue).toHaveLength(1)

    await tracker.undo()
    expect([titleNow(source), titleNow(target)]).toEqual(['Source', 'Target'])
  })

  it('makes each edit outside a batch its own undo step', () => {
    handleOf(source).setTitle('One')
    handleOf(target).setTitle('Two')

    expect(tracker.undoQueue).toHaveLength(2)
  })

  it('makes a slot edit and a connection undo steps that undo reverses', async () => {
    handleOf(target).inputs.at(0)?.modify({ label: 'Shown' })
    handleOf(source).outputs.at(0)?.connectTo(String(target.id), 'in')

    expect(tracker.undoQueue).toHaveLength(2)

    await tracker.undo()
    expect(app.rootGraph.getNodeById(target.id)?.isInputConnected(0)).toBe(
      false
    )
    expect(app.rootGraph.getNodeById(target.id)?.inputs[0].label).toBe('Shown')

    await tracker.undo()
    expect(
      app.rootGraph.getNodeById(target.id)?.inputs[0].label
    ).toBeUndefined()

    await tracker.redo()
    await tracker.redo()
    expect(app.rootGraph.getNodeById(target.id)?.isInputConnected(0)).toBe(true)
  })

  it('makes adding a node one undo step that undo removes', async () => {
    LiteGraph.registerNodeType('EditTest/Added', class extends LGraphNode {})
    const root = comfy.graph.root()
    assert(root)
    const before = app.rootGraph.nodes.length

    expect(comfy.edit.addNode(root, 'EditTest/Added')).toBeDefined()
    expect(app.rootGraph.nodes).toHaveLength(before + 1)
    expect(tracker.undoQueue).toHaveLength(1)

    await tracker.undo()
    expect(app.rootGraph.nodes).toHaveLength(before)

    await tracker.redo()
    expect(app.rootGraph.nodes).toHaveLength(before + 1)
  })

  function trackedGroup() {
    const group = new LGraphGroup('Tracked')
    group.pos = [0, 0]
    group.size = [400, 300]
    app.rootGraph.add(group)
    tracker.reset(fromAny(app.rootGraph.serialize()))
    const [handle] = comfy.graph.groups() ?? []
    assert(handle)
    return handle
  }

  function groupBoundsNow() {
    return app.rootGraph.groups.map((group) => Array.from(group.boundingRect))
  }

  it('makes moving and resizing a group one undo step that undo reverses and redo repeats, keeping its handle', async () => {
    const handle = trackedGroup()

    expect(handle.setBounds({ x: 30, y: 40, width: 500, height: 350 })).toBe(
      true
    )
    expect(tracker.undoQueue).toHaveLength(1)
    expect(workflow.isModified).toBe(true)

    await tracker.undo()
    expect(groupBoundsNow()).toEqual([[0, 0, 400, 300]])
    expect(handle.getBounds()).toEqual({ x: 0, y: 0, width: 400, height: 300 })
    expect(comfy.graph.groups()?.[0]).toBe(handle)
    expect(workflow.isModified).toBe(false)

    await tracker.redo()
    expect(groupBoundsNow()).toEqual([[30, 40, 500, 350]])
    expect(handle.isDeleted).toBe(false)
  })

  it('makes a group resize and the node moves around it one step inside a batch', async () => {
    const handle = trackedGroup()
    const sourceBefore = handleOf(source).getPosition()

    comfy.edit.batch(() => {
      handleOf(source).setPosition({ x: 600, y: 700 })
      handle.setBounds({ x: 550, y: 600, width: 400, height: 300 })
    })

    expect(tracker.undoQueue).toHaveLength(1)

    await tracker.undo()
    expect(groupBoundsNow()).toEqual([[0, 0, 400, 300]])
    expect(handleOf(source).getPosition()).toEqual(sourceBefore)
    expect(sourceBefore).not.toEqual({ x: 600, y: 700 })
  })

  it('adds no step for an edit that changes nothing the workflow saves', () => {
    handleOf(source).setResizable(false)
    handleOf(source).setTitle('Source')

    expect(tracker.undoQueue).toHaveLength(0)
    expect(workflow.isModified).toBe(false)
  })
})
