import { assert, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { ExecutedWsMessage } from '@comfyorg/api-client/executionTypes'
import { app } from '@/scripts/app'
import {
  useNodeOutputStore,
  writeExecutedOutput
} from '@/stores/nodeOutputStore'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

vi.mock(import('@/scripts/app'))

function arrangeTwoInstances() {
  const rootGraph = createTestRootGraph()
  const definition = createTestSubgraph({ rootGraph })
  rootGraph.subgraphs.set(definition.id, definition)
  const interior = new LGraphNode('SaveImage')
  interior.id = toNodeId(10)
  definition.add(interior)
  const [first, second] = [5, 6].map((id) => {
    const host = createTestSubgraphNode(definition, { id })
    rootGraph.add(host)
    return host
  })
  Object.assign(app, { rootGraph })

  return {
    rootGraph,
    interior,
    first,
    second,
    locator: createNodeLocatorId(definition.id, interior.id),
    firstRun: createNodeExecutionId([first.id, interior.id]),
    secondRun: createNodeExecutionId([second.id, interior.id])
  }
}

function images(...filenames: string[]): ExecutedWsMessage['output'] {
  return { images: filenames.map((filename) => ({ filename })) }
}

function filenames(output: ExecutedWsMessage['output'] | undefined) {
  return output?.images?.map((image) => image.filename)
}

describe('nodeOutputStore with two instances of one subgraph definition', () => {
  it('keeps each instance its own executed output', () => {
    const { firstRun, secondRun } = arrangeTwoInstances()
    const store = useNodeOutputStore()

    store.setNodeOutputsByExecutionId(firstRun, images('hostA.png'))
    store.setNodeOutputsByExecutionId(secondRun, images('hostB.png'))

    expect(filenames(store.getNodeOutputByExecutionId(firstRun))).toEqual([
      'hostA.png'
    ])
    expect(filenames(store.getNodeOutputByExecutionId(secondRun))).toEqual([
      'hostB.png'
    ])
  })

  it('merges an output only into the instance that produced it', () => {
    const { firstRun, secondRun } = arrangeTwoInstances()
    const store = useNodeOutputStore()

    store.setNodeOutputsByExecutionId(firstRun, images('hostA.png'))
    store.setNodeOutputsByExecutionId(secondRun, images('hostB.png'), {
      merge: true
    })

    expect(filenames(store.getNodeOutputByExecutionId(secondRun))).toEqual([
      'hostB.png'
    ])
  })

  it('shows nothing for an instance that has not run while another has', () => {
    const { firstRun, secondRun } = arrangeTwoInstances()
    const store = useNodeOutputStore()

    store.setNodeOutputsByExecutionId(firstRun, images('hostA.png'))
    store.setNodePreviewsByExecutionId(firstRun, ['blob:hostA'])

    expect(store.getNodeOutputByExecutionId(secondRun)).toBeUndefined()
    expect(store.getNodePreviewImagesByExecutionId(secondRun)).toBeUndefined()
  })

  it('shows an output set from the shared widget on every instance', () => {
    const { interior, firstRun, secondRun } = arrangeTwoInstances()
    const store = useNodeOutputStore()
    store.setNodeOutputsByExecutionId(firstRun, images('hostA.png'))
    store.setNodeOutputsByExecutionId(secondRun, images('hostB.png'))

    store.setNodeOutputs(interior, 'upload.png')

    expect(filenames(store.getNodeOutputByExecutionId(firstRun))).toEqual([
      'upload.png'
    ])
    expect(filenames(store.getNodeOutputByExecutionId(secondRun))).toEqual([
      'upload.png'
    ])
  })

  it.for([{ merge: false }, { merge: true }])(
    'keeps the shared input preview once when an instance first runs without images (%o)',
    (options) => {
      const { interior, firstRun } = arrangeTwoInstances()
      const store = useNodeOutputStore()
      store.setNodeOutputs(interior, 'upload.png')

      store.setNodeOutputsByExecutionId(firstRun, { text: ['done'] }, options)

      expect(store.getNodeOutputByExecutionId(firstRun)).toMatchObject({
        text: ['done'],
        images: [expect.objectContaining({ filename: 'upload.png' })]
      })
    }
  )

  it('keeps one instance live preview when the other instance starts', () => {
    const { firstRun, secondRun } = arrangeTwoInstances()
    const store = useNodeOutputStore()
    store.setNodePreviewsByExecutionId(firstRun, ['blob:hostA'])
    store.setNodePreviewsByExecutionId(secondRun, ['blob:hostB'])

    store.revokePreviewsByExecutionId(secondRun)
    vi.runAllTimers()

    expect(store.getNodePreviewImagesByExecutionId(firstRun)).toEqual([
      'blob:hostA'
    ])
    expect(store.getNodePreviewImagesByExecutionId(secondRun)).toBeUndefined()
  })

  it('keeps the newer frame of another instance when an instance starts', () => {
    const { locator, firstRun, secondRun } = arrangeTwoInstances()
    const store = useNodeOutputStore()
    store.setNodePreviewsByExecutionId(firstRun, ['blob:hostA'])
    store.setNodePreviewsByExecutionId(secondRun, ['blob:hostB'])

    store.revokePreviewsByExecutionId(firstRun)
    vi.runAllTimers()

    expect(store.nodePreviewImages[locator]).toEqual(['blob:hostB'])
    expect(app.nodePreviewImages[locator]).toEqual(['blob:hostB'])
    expect(store.getNodePreviewImagesByExecutionId(secondRun)).toEqual([
      'blob:hostB'
    ])
    expect(store.getNodePreviewImagesByExecutionId(firstRun)).toBeUndefined()
  })

  it('keeps instances apart across a snapshot and restore', () => {
    const { firstRun, secondRun } = arrangeTwoInstances()
    const store = useNodeOutputStore()
    store.setNodeOutputsByExecutionId(firstRun, images('hostA.png'))
    store.setNodeOutputsByExecutionId(secondRun, images('hostB.png'))

    const snapshot = store.snapshotOutputs()
    store.resetAllOutputsAndPreviews()
    store.restoreOutputs(snapshot)

    expect(filenames(store.getNodeOutputByExecutionId(firstRun))).toEqual([
      'hostA.png'
    ])
    expect(filenames(store.getNodeOutputByExecutionId(secondRun))).toEqual([
      'hostB.png'
    ])
  })

  it('shows nothing for the remaining instance after a snapshot of a removed instance output', () => {
    const { rootGraph, first, firstRun, secondRun } = arrangeTwoInstances()
    const store = useNodeOutputStore()
    store.setNodeOutputsByExecutionId(firstRun, images('hostA.png'))
    rootGraph.remove(first)

    const snapshot = store.snapshotOutputs()
    store.resetAllOutputsAndPreviews()
    store.restoreOutputs(snapshot)

    expect(store.getNodeOutputByExecutionId(secondRun)).toBeUndefined()
  })

  it('restores per-instance outputs from a job loaded from history', () => {
    const { firstRun, secondRun } = arrangeTwoInstances()
    const store = useNodeOutputStore()

    store.restoreJobOutputs({
      [firstRun]: images('hostA.png'),
      [secondRun]: images('hostB.png')
    })

    expect(filenames(store.getNodeOutputByExecutionId(firstRun))).toEqual([
      'hostA.png'
    ])
    expect(filenames(store.getNodeOutputByExecutionId(secondRun))).toEqual([
      'hostB.png'
    ])
  })

  it('restores a run recorded after the snapshot over the run the snapshot holds', () => {
    const { locator, firstRun } = arrangeTwoInstances()
    const store = useNodeOutputStore()
    store.setNodeOutputsByExecutionId(firstRun, images('run1.png'))
    const snapshot = store.snapshotOutputs()

    writeExecutedOutput(snapshot, locator, firstRun, images('run2.png'), {})
    store.resetAllOutputsAndPreviews()
    store.restoreOutputs(snapshot)

    expect({
      instance: filenames(store.getNodeOutputByExecutionId(firstRun)),
      shared: filenames(store.nodeOutputs[locator]),
      app: filenames(app.nodeOutputs[locator])
    }).toEqual({
      instance: ['run2.png'],
      shared: ['run2.png'],
      app: ['run2.png']
    })
  })

  it('exposes the latest output of any instance under the locator on app.nodeOutputs', () => {
    const { locator, firstRun, secondRun } = arrangeTwoInstances()
    const store = useNodeOutputStore()

    store.setNodeOutputsByExecutionId(firstRun, images('hostA.png'))
    store.setNodeOutputsByExecutionId(secondRun, images('hostB.png'))

    expect(Object.keys(app.nodeOutputs)).toEqual([locator])
    expect(filenames(app.nodeOutputs[locator])).toEqual(['hostB.png'])
  })

  it('prunes the entries of a subgraph node removed from the root graph', () => {
    const { rootGraph, second, locator, firstRun, secondRun } =
      arrangeTwoInstances()
    const store = useNodeOutputStore()
    store.setNodeOutputsByExecutionId(firstRun, images('hostA.png'))
    store.setNodeOutputsByExecutionId(secondRun, images('hostB.png'))

    rootGraph.remove(second)

    const snapshot = store.snapshotOutputs()
    assert.exists(snapshot.instances[locator]?.[firstRun])
    expect(snapshot.instances[locator]?.[secondRun]).toBeUndefined()
  })

  it('prunes the entries of a subgraph node removed inside a definition', () => {
    const rootGraph = createTestRootGraph()
    const innerDefinition = createTestSubgraph({ rootGraph })
    const outerDefinition = createTestSubgraph({ rootGraph })
    rootGraph.subgraphs.set(innerDefinition.id, innerDefinition)
    rootGraph.subgraphs.set(outerDefinition.id, outerDefinition)
    const leaf = new LGraphNode('SaveImage')
    leaf.id = toNodeId(10)
    innerDefinition.add(leaf)
    const innerHost = createTestSubgraphNode(innerDefinition, {
      id: 20,
      parentGraph: outerDefinition
    })
    outerDefinition.add(innerHost)
    const outerHost = createTestSubgraphNode(outerDefinition, { id: 5 })
    rootGraph.add(outerHost)
    Object.assign(app, { rootGraph })
    const leafRun = createNodeExecutionId([outerHost.id, innerHost.id, leaf.id])
    const store = useNodeOutputStore()
    store.setNodeOutputsByExecutionId(leafRun, images('nested.png'))

    outerDefinition.remove(innerHost)

    const locator = createNodeLocatorId(innerDefinition.id, leaf.id)
    expect(
      store.snapshotOutputs().instances[locator]?.[leafRun]
    ).toBeUndefined()
  })
})
