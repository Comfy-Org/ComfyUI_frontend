import { fromPartial } from '@total-typescript/shoehorn'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExtensionService } from '@/platform/extensions/services/extensionService'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { NODE_TYPE_HOOKS_NAME } from '@/platform/nodeApi/v4/defs/nodeTypeHooksName'
import { hostNodeDef } from '@/platform/nodeApi/v4/defs/__fixtures__/hostNodeTypes'
import type { NodeDef } from '@/platform/nodeApi/v4/types'
import { uploadImageExtension } from '@/extensions/core/uploadImage'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'

import { publishedApi, withoutPublishedApi } from './__tests__/publishedApi'
import { registerPublishedTestPack } from './__tests__/testPack'
import { useComfyApiStore } from './comfyApiStore'

function showOnCanvas(graph: LGraph) {
  const previousCanvas = app.canvasOrUndefined
  onTestFinished(() => {
    Reflect.set(app, 'canvasInternal', previousCanvas)
  })
  const canvas = fromPartial<LGraphCanvas>({ graph })
  app.canvas = canvas
  return canvas
}

describe("the app's node API", () => {
  beforeEach(withoutPublishedApi)

  it('publishes the same API however often it is published', () => {
    const first = publishedApi()

    expect(publishedApi()).toBe(first)
  })

  it('adds nothing to the window but comfy_v4', () => {
    const before = new Set(Reflect.ownKeys(window))

    publishedApi()

    expect(Reflect.ownKeys(window).filter((key) => !before.has(key))).toEqual([
      'comfy_v4'
    ])
  })

  it('publishes the API as a visible, read-only property of the window', () => {
    const comfy = publishedApi()

    expect(Object.getOwnPropertyDescriptor(window, 'comfy_v4')).toEqual({
      value: comfy,
      writable: false,
      enumerable: true,
      configurable: true
    })
  })

  it('refuses a pack that assigns over the published API', () => {
    const comfy = publishedApi()

    expect(() => {
      window.comfy_v4 = Object.freeze({ ...comfy })
    }).toThrow(TypeError)
    expect(window.comfy_v4).toBe(comfy)
  })

  it('has no graph to show before the app has a canvas', () => {
    const comfy = publishedApi()

    expect(app.canvasOrUndefined).toBeUndefined()
    expect(comfy.graph.id).toBeUndefined()
  })

  it('shows packs the graph on the canvas, and the one the canvas switches to', () => {
    const comfy = publishedApi()
    const root = new LGraph()
    root.add(new LGraphNode('On screen'))
    const entered = new LGraph()
    const canvas = showOnCanvas(root)

    expect(comfy.graph.id).toBe(root.id)
    expect(comfy.graph.nodes().map((node) => node.getTitle())).toEqual([
      'On screen'
    ])

    canvas.graph = entered

    expect(comfy.graph.id).toBe(entered.id)
  })

  it('tells packs the app is ready when the host says so', () => {
    const comfy = publishedApi()
    const listener = vi.fn()
    comfy.onReady(listener)

    expect(listener).not.toHaveBeenCalled()

    useComfyApiStore().markReady()

    expect(listener).toHaveBeenCalledOnce()
  })

  it('makes a listener added while the canvas starts up again wait for that startup to be ready', async () => {
    const comfy = publishedApi()
    useComfyApiStore().markReady()
    const listener = vi.fn()

    publishedApi()
    comfy.onReady(listener)
    await Promise.resolve()

    expect(listener).not.toHaveBeenCalled()

    useComfyApiStore().markReady()

    expect(listener).toHaveBeenCalledOnce()
  })

  it('retires the handles packs hold when the host begins another document', () => {
    const comfy = publishedApi()
    const graph = new LGraph()
    const node = new LGraphNode('Kept')
    graph.add(node)
    showOnCanvas(graph)
    const kept = comfy.graph.node(node.id)
    assert(kept)

    useComfyApiStore().beginDocument()

    expect(kept.isDeleted).toBe(true)
    expect(comfy.graph.node(node.id)?.isDeleted).toBe(false)
  })

  it('retires the handles to nodes an undo removed when the host says it has restored history', () => {
    const comfy = publishedApi()
    const graph = new LGraph()
    const stays = new LGraphNode('Stays')
    graph.add(stays)
    const beforeAdding = graph.serialize()
    const removed = new LGraphNode('Removed')
    graph.add(removed)
    showOnCanvas(graph)
    const staysHandle = comfy.graph.node(stays.id)
    const removedHandle = comfy.graph.node(removed.id)
    assert(staysHandle && removedHandle)

    graph.configure(beforeAdding)
    useComfyApiStore().afterHistoryRestore()
    const sameId = new LGraphNode('Added under the removed id')
    graph.add(sameId)

    expect(sameId.id).toBe(removed.id)
    expect(staysHandle.isDeleted).toBe(false)
    expect(removedHandle.isDeleted).toBe(true)
    expect(comfy.graph.node(sameId.id)).not.toBe(removedHandle)
  })

  it("passes a pack's edit to the open workflow's change tracker as one transaction", () => {
    const comfy = publishedApi()
    const graph = new LGraph()
    const node = new LGraphNode('Before')
    graph.add(node)
    showOnCanvas(graph)
    const steps: string[] = []
    useWorkflowStore().activeWorkflow = fromPartial({
      changeTracker: {
        beforeChange: () => steps.push('before'),
        afterChange: () => steps.push(`after ${node.title}`)
      }
    })
    const handle = comfy.graph.node(String(node.id))
    assert(handle)

    handle.setTitle('After')

    expect(steps).toEqual(['before', 'after After'])
  })

  it('lets a pack extend the node types the host registers', async () => {
    const comfy = publishedApi()
    const packId = registerPublishedTestPack(comfy)
    const titles: string[] = []
    onTestFinished(
      comfy.defs.extend(packId, 'HostType', (builder) =>
        titles.push(builder.def.title)
      )
    )

    await useLitegraphService().registerNodeDef(
      'HostType',
      hostNodeDef('HostType', { display_name: 'From the host' })
    )

    expect(titles).toEqual(['From the host'])
  })

  it('hears the host register node types however often it is published', async () => {
    const comfy = publishedApi()
    const packId = registerPublishedTestPack(comfy)
    publishedApi()
    const extended = vi.fn()
    onTestFinished(comfy.defs.extend(packId, 'HostType', extended))

    await useLitegraphService().registerNodeDef(
      'HostType',
      hostNodeDef('HostType')
    )

    expect(extended).toHaveBeenCalledOnce()
  })

  it('tells packs when the host reloads the node definitions', async () => {
    const comfy = publishedApi()
    const listener = vi.fn()
    comfy.defs.onRefreshed(listener)

    await useExtensionService().invokeExtensionsAsync('refreshComboInNodes', {})

    expect(listener).toHaveBeenCalledOnce()
  })

  it('adds the menu entries packs give a type to the host node menu', async () => {
    const comfy = publishedApi()
    const packId = registerPublishedTestPack(comfy)
    onTestFinished(
      comfy.defs.extend(packId, 'HostType', (builder) =>
        builder.addMenuItem({ label: 'From a pack', run: () => {} })
      )
    )
    await useLitegraphService().registerNodeDef(
      'HostType',
      hostNodeDef('HostType')
    )
    const graph = new LGraph()
    const node = LiteGraph.createNode('HostType')
    assert(node)
    graph.add(node)

    expect(
      app.collectNodeMenuItems(node).map((item) => item.content)
    ).toContain('From a pack')
  })

  it('keeps hearing node types when a user has disabled the hook extension', async () => {
    useExtensionStore().loadDisabledExtensionNames([NODE_TYPE_HOOKS_NAME])
    const comfy = publishedApi()
    const packId = registerPublishedTestPack(comfy)
    const extended = vi.fn()
    onTestFinished(comfy.defs.extend(packId, 'HostType', extended))

    await useLitegraphService().registerNodeDef(
      'HostType',
      hostNodeDef('HostType')
    )

    expect(extended).toHaveBeenCalledOnce()
  })

  it('puts the hooks on the class the host makes when it registers a type again', async () => {
    const comfy = publishedApi()
    const packId = registerPublishedTestPack(comfy)
    const onRemoved = vi.fn()
    onTestFinished(
      comfy.defs.extend(packId, 'HostType', (builder) =>
        builder.onRemoved(onRemoved)
      )
    )
    await useLitegraphService().registerNodeDef(
      'HostType',
      hostNodeDef('HostType')
    )
    await useLitegraphService().registerNodeDef(
      'HostType',
      hostNodeDef('HostType')
    )
    const graph = new LGraph()
    const node = LiteGraph.createNode('HostType')
    assert(node)
    graph.add(node)

    graph.remove(node)

    expect(onRemoved).toHaveBeenCalledOnce()
  })

  it('tells packs when the app reloads the node definitions', async () => {
    const comfy = publishedApi()
    const listener = vi.fn()
    comfy.defs.onRefreshed(listener)
    const previousGraph = app.rootGraphOrUndefined
    onTestFinished(() => {
      Reflect.set(app, 'rootGraphInternal', previousGraph)
    })
    Reflect.set(app, 'rootGraphInternal', new LGraph())

    await expect(app.reloadNodeDefs({})).resolves.toBe(true)

    expect(listener).toHaveBeenCalledOnce()
  })

  it('gives apply and get the same definition when a core extension adds an input as the type registers', async () => {
    const comfy = publishedApi()
    const packId = registerPublishedTestPack(comfy)
    useExtensionService().registerExtension(uploadImageExtension)
    const loader = () =>
      hostNodeDef('ImageLoader', {
        input: { required: { image: [['a.png'], { image_upload: true }] } }
      })
    const hasUpload = (def: NodeDef) =>
      def.inputs.some((input) => input.type === 'IMAGEUPLOAD')
    const seen: string[][] = []
    const before = vi.fn()
    onTestFinished(
      comfy.defs.extend(packId, 'ImageLoader', (builder) =>
        seen.push(builder.def.inputs.map((input) => input.name))
      )
    )
    onTestFinished(comfy.defs.extend(packId, hasUpload, before))

    await useLitegraphService().registerNodeDef('ImageLoader', loader())
    const after = vi.fn()
    onTestFinished(comfy.defs.extend(packId, hasUpload, after))

    expect(seen).toEqual([
      comfy.defs.get('ImageLoader')?.inputs.map((input) => input.name)
    ])
    expect(after.mock.calls.length).toBe(before.mock.calls.length)
  })
})
