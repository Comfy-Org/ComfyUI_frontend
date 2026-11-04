import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { assert, describe, expect, it } from 'vitest'

import type { ISerialisedGraph } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  findMissingNodeTypes,
  isolateWorkflowIds,
  openDetachedAppGraph,
  withDetachedAppGraph
} from '@/renderer/extensions/superComfy/apps/detachedAppGraph'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphToPrompt } from '@/utils/executionUtil'

const ROOT_ID = '6b1f0c2a-3d4e-4f50-8a6b-7c8d9e0f1a2b'
const SUBGRAPH_ID = '0e9d8c7b-6a5f-4e3d-8c2b-1a0f9e8d7c6b'
const NESTED_ID = '1f2e3d4c-5b6a-4987-8f6e-5d4c3b2a1f0e'

function rawNode(id: number, type: string, mode = 0) {
  return {
    id,
    type,
    pos: [0, 0],
    size: [200, 100],
    flags: {},
    order: id,
    mode,
    properties: {}
  }
}

function rawDefinition(
  id: string,
  nodes: ReturnType<typeof rawNode>[],
  nested: unknown[] = []
) {
  return {
    id,
    revision: 0,
    name: id,
    version: 1,
    state: { lastGroupId: 0, lastNodeId: 50, lastLinkId: 0, lastRerouteId: 0 },
    nodes,
    links: [],
    inputNode: { id: -10, bounding: [0, 0, 10, 10] },
    outputNode: { id: -20, bounding: [0, 0, 10, 10] },
    definitions: { subgraphs: nested }
  }
}

function rawWorkflow(
  nodes: ReturnType<typeof rawNode>[],
  subgraphs: unknown[] = []
) {
  return {
    id: ROOT_ID,
    version: 1,
    state: { lastGroupId: 0, lastNodeId: 50, lastLinkId: 0, lastRerouteId: 0 },
    nodes,
    links: [],
    definitions: { subgraphs }
  }
}

const SUBGRAPHS = [
  rawDefinition(
    SUBGRAPH_ID,
    [rawNode(3, 'VAEDecode'), rawNode(4, NESTED_ID)],
    [rawDefinition(NESTED_ID, [rawNode(5, 'SaveImage')])]
  )
]

async function parsed(raw: unknown): Promise<ComfyWorkflowJSON> {
  const workflow = await validateComfyWorkflow(raw)
  assert.exists(workflow)
  return workflow
}

describe('isolateWorkflowIds', () => {
  it('gives the copy a fresh root id and leaves the original alone', async () => {
    const original = await parsed(
      rawWorkflow([rawNode(1, 'KSampler'), rawNode(2, SUBGRAPH_ID)], SUBGRAPHS)
    )

    const isolated = isolateWorkflowIds(original)

    expect(isolated.id).not.toBe(ROOT_ID)
    expect(original).toMatchObject({
      id: ROOT_ID,
      nodes: [{ type: 'KSampler' }, { type: SUBGRAPH_ID }],
      definitions: { subgraphs: [{ id: SUBGRAPH_ID }] }
    })
  })

  it('re-mints subgraph ids and renames every node of that type the same way', async () => {
    const isolated = isolateWorkflowIds(
      await parsed(
        rawWorkflow(
          [rawNode(1, 'KSampler'), rawNode(2, SUBGRAPH_ID)],
          SUBGRAPHS
        )
      )
    )
    const outer = isolated.definitions?.subgraphs.at(0)
    const nested = outer?.definitions?.subgraphs.at(0)
    assert.exists(outer)
    assert.exists(nested)

    expect([outer.id, nested.id]).not.toContain(SUBGRAPH_ID)
    expect([outer.id, nested.id]).not.toContain(NESTED_ID)
    expect(isolated).toMatchObject({
      nodes: [{ type: 'KSampler' }, { type: outer.id }],
      definitions: {
        subgraphs: [
          {
            id: outer.id,
            nodes: [{ type: 'VAEDecode' }, { type: nested.id }],
            definitions: { subgraphs: [{ id: nested.id }] }
          }
        ]
      }
    })
  })
})

describe('findMissingNodeTypes', () => {
  it('lists each unregistered type once, across the root and subgraphs', async () => {
    const workflow = await parsed(
      rawWorkflow(
        [
          rawNode(1, 'KSampler'),
          rawNode(6, 'CustomUpscaler'),
          rawNode(7, 'CustomUpscaler'),
          rawNode(2, SUBGRAPH_ID)
        ],
        SUBGRAPHS
      )
    )

    expect(
      findMissingNodeTypes(workflow, (type) => type === 'KSampler')
    ).toEqual(['CustomUpscaler', 'VAEDecode', 'SaveImage'])
  })

  it('ignores muted and bypassed nodes', async () => {
    const workflow = await parsed(
      rawWorkflow([rawNode(6, 'MutedNode', 2), rawNode(7, 'BypassedNode', 4)])
    )

    expect(findMissingNodeTypes(workflow, () => false)).toEqual([])
  })
})

class FakeLoader extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Fake Loader')
    this.comfyClass = 'FakeLoader'
    this.serialize_widgets = true
    this.addWidget('combo', 'image', 'cat.png', () => undefined, {
      values: ['cat.png', 'dog.png']
    })
    this.addOutput('IMAGE', 'IMAGE')
  }
}

class FakeSave extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Fake Save')
    this.comfyClass = 'FakeSave'
    this.serialize_widgets = true
    this.addInput('images', 'IMAGE')
    this.addWidget('text', 'filename_prefix', 'ComfyUI', () => undefined, {})
  }
}

class FakeSampler extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Fake Sampler')
    this.comfyClass = 'FakeSampler'
    this.serialize_widgets = true
    this.addWidget('number', 'seed', 0, () => undefined, {})
  }
}

class FakePrimitive extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Fake Primitive')
    this.comfyClass = 'FakePrimitive'
    this.isVirtualNode = true
  }

  override onAfterGraphConfigured() {
    const target = this.graph?.getNodeById(
      toNodeId(String(this.properties.target))
    )
    const seed = target?.widgets?.find(({ name }) => name === 'seed')
    if (seed) seed.value = Number(this.properties.value)
  }
}

function registerFakeTypes() {
  LiteGraph.registerNodeType('FakeLoader', FakeLoader)
  LiteGraph.registerNodeType('FakeSave', FakeSave)
  LiteGraph.registerNodeType('FakeSampler', FakeSampler)
  LiteGraph.registerNodeType('FakePrimitive', FakePrimitive)
}

async function savedApp(): Promise<{
  serialised: ISerialisedGraph
  workflow: ComfyWorkflowJSON
}> {
  const scratch = new LGraph()
  const loader = LiteGraph.createNode('FakeLoader')
  const save = LiteGraph.createNode('FakeSave')
  assert.exists(loader)
  assert.exists(save)
  scratch.add(loader)
  scratch.add(save)
  loader.connect(0, save, 0)
  const image = loader.widgets?.find(({ name }) => name === 'image')
  assert.exists(image)
  image.value = 'dog.png'
  const { workflow } = await graphToPrompt(scratch)
  return {
    serialised: { ...scratch.serialize(), id: ROOT_ID },
    workflow: { ...workflow, id: ROOT_ID }
  }
}

describe('openDetachedAppGraph', () => {
  it('leaves a canvas graph loaded from the same app intact after it is disposed', async () => {
    registerFakeTypes()
    const app = await savedApp()
    const canvas = new LGraph()
    canvas.configure(app.serialised)
    const before = canvas.serialize()
    const loader = canvas.nodes.find(({ type }) => type === 'FakeLoader')
    const save = canvas.nodes.find(({ type }) => type === 'FakeSave')
    assert.exists(loader)
    assert.exists(save)

    const opening = openDetachedAppGraph(app.workflow)
    assert(opening.ok)
    opening.detached.dispose()

    expect(
      useWidgetValueStore().getWidget(widgetId(ROOT_ID, loader.id, 'image'))
        ?.value
    ).toBe('dog.png')
    expect(save.isInputConnected(0)).toBe(true)
    expect(canvas.serialize()).toEqual(before)
  })

  it('keeps the canvas subgraph type and removes the copies it registered', async () => {
    registerFakeTypes()
    class CanvasSubgraph extends LGraphNode {}
    LiteGraph.registerNodeType(SUBGRAPH_ID, CanvasSubgraph)
    const typesBefore = Object.keys(LiteGraph.registered_node_types)
    const defsBefore = Object.keys(useNodeDefStore().nodeDefsByName)
    const app = await parsed({
      ...(await savedApp()).workflow,
      definitions: {
        subgraphs: [rawDefinition(SUBGRAPH_ID, [rawNode(3, 'FakeSampler')])]
      }
    })

    const opening = openDetachedAppGraph(app)
    assert(opening.ok)
    const typesWhileOpen = Object.keys(LiteGraph.registered_node_types)
    opening.detached.dispose()

    expect(typesWhileOpen.length).toBeGreaterThan(typesBefore.length)
    expect(LiteGraph.registered_node_types[SUBGRAPH_ID]).toBe(CanvasSubgraph)
    expect(Object.keys(LiteGraph.registered_node_types)).toEqual(typesBefore)
    expect(Object.keys(useNodeDefStore().nodeDefsByName)).toEqual(defsBefore)
  })

  it('runs the configure callbacks, so values nodes build after loading reach the prompt', async () => {
    registerFakeTypes()
    const scratch = new LGraph()
    const sampler = LiteGraph.createNode('FakeSampler')
    const primitive = LiteGraph.createNode('FakePrimitive')
    assert.exists(sampler)
    assert.exists(primitive)
    scratch.add(sampler)
    scratch.add(primitive)
    primitive.properties.target = sampler.id
    primitive.properties.value = 77
    const { workflow } = await graphToPrompt(scratch)

    const prompt = await withDetachedAppGraph(workflow, (graph) =>
      graphToPrompt(graph)
    )

    assert(prompt.ok)
    expect(prompt.value.output[String(sampler.id)].inputs).toEqual({ seed: 77 })
  })
})
