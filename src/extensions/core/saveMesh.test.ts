import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import type { useLoad3d } from '@/composables/useLoad3d'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { useExtensionService } from '@/services/extensionService'
import type { useLoad3dService } from '@/services/load3dService'
import type { ComfyExtension } from '@/types/comfy'
import type * as GraphTraversalModule from '@/utils/graphTraversalUtil'

const {
  registerExtensionMock,
  waitForLoad3dMock,
  onLoad3dReadyMock,
  configureForSaveMeshMock
} = vi.hoisted(() => ({
  registerExtensionMock: vi.fn(),
  waitForLoad3dMock: vi.fn(),
  onLoad3dReadyMock: vi.fn(),
  configureForSaveMeshMock: vi.fn()
}))

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({
      registerExtension: registerExtensionMock
    })
}))

vi.mock(import('@/services/load3dService'), () => ({
  useLoad3dService: () =>
    fromPartial<ReturnType<typeof useLoad3dService>>({ getLoad3d: vi.fn() })
}))

vi.mock(import('@/composables/useLoad3d'), () => ({
  useLoad3d: () =>
    fromPartial<ReturnType<typeof useLoad3d>>({
      waitForLoad3d: waitForLoad3dMock,
      onLoad3dReady: onLoad3dReadyMock
    })
}))

vi.mock(import('@/extensions/core/load3d/Load3DConfiguration'), () => ({
  default: fromAny(
    class {
      configureForSaveMesh = configureForSaveMeshMock
    }
  )
}))

vi.mock(import('@/extensions/core/load3d/exportMenuHelper'), () => ({
  createExportMenuItems: vi.fn(() => [])
}))

vi.mock(import('@/components/load3d/Load3D.vue'), () => ({
  default: defineComponent({ render: () => null })
}))

vi.mock(import('@/scripts/domWidget'), () => ({
  ComponentWidgetImpl: fromAny(vi.fn()),
  addWidget: vi.fn()
}))

vi.mock(import('@/platform/assets/utils/assetPreviewUtil'), () => ({
  isAssetPreviewSupported: vi.fn(() => false),
  persistThumbnail: vi.fn()
}))

vi.mock(import('@/scripts/app'))

vi.mock(import('@/utils/graphTraversalUtil'))

type SaveMeshExtension = ComfyExtension & {
  nodeCreated: (node: LGraphNode) => Promise<void>
  onNodeOutputsUpdated: (
    nodeOutputs: Record<string, Record<string, unknown>>
  ) => void
}

interface LoadedSaveMeshExtension {
  extension: SaveMeshExtension
  graphTraversal: typeof GraphTraversalModule
}

async function loadSaveMeshExtensionFresh(): Promise<LoadedSaveMeshExtension> {
  vi.resetModules()
  const graphTraversal = await import('@/utils/graphTraversalUtil')
  await import('@/extensions/core/saveMesh')
  return {
    extension: registerExtensionMock.mock.calls[0][0] as SaveMeshExtension,
    graphTraversal
  }
}

function makeNode(
  overrides: Partial<{
    comfyClass: string
    properties: Record<string, unknown>
  }> = {}
): LGraphNode {
  const { comfyClass = 'SaveGLB', properties = {} } = overrides
  return fromAny<LGraphNode, unknown>({
    constructor: { comfyClass },
    size: [400, 550],
    setSize: vi.fn(),
    widgets: [{ name: 'image', value: '' }],
    properties
  })
}

describe('saveMesh', () => {
  beforeEach(() => {
    const fakeLoad3d = () => ({
      whenLoadIdle: () => Promise.resolve(),
      captureThumbnail: vi.fn()
    })
    waitForLoad3dMock.mockImplementation((cb: (load3d: unknown) => void) => {
      cb(fakeLoad3d())
    })
    onLoad3dReadyMock.mockImplementation((cb: (load3d: unknown) => void) => {
      cb(fakeLoad3d())
    })
  })

  it('registers a single Comfy.SaveGLB extension on import', async () => {
    const { extension } = await loadSaveMeshExtensionFresh()

    expect(registerExtensionMock).toHaveBeenCalledOnce()
    expect(extension.name).toBe('Comfy.SaveGLB')
    expect(typeof extension.nodeCreated).toBe('function')
  })

  it('skips nodes whose comfyClass is not SaveGLB', async () => {
    const { extension } = await loadSaveMeshExtensionFresh()
    const node = makeNode({ comfyClass: 'OtherNode' })

    await extension.nodeCreated(node)

    expect(waitForLoad3dMock).not.toHaveBeenCalled()
    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('does not load a model on creation when no Last Time Model File is persisted', async () => {
    const { extension } = await loadSaveMeshExtensionFresh()
    const node = makeNode()

    await extension.nodeCreated(node)

    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('restores the persisted model on creation using the persisted folder', async () => {
    const { extension } = await loadSaveMeshExtensionFresh()
    const node = makeNode({
      properties: {
        'Last Time Model File': 'sub/model.glb',
        'Last Time Model Folder': 'output'
      }
    })

    await extension.nodeCreated(node)

    expect(configureForSaveMeshMock).toHaveBeenCalledWith(
      'output',
      'sub/model.glb',
      { silentOnNotFound: true }
    )
    expect(node.widgets?.find((w) => w.name === 'image')?.value).toBe(
      'sub/model.glb'
    )
  })

  it('registers a persistent onLoad3dReady hook so subgraph re-entry rehydrates the model', async () => {
    const onReadyCallbacks: Array<(load3d: unknown) => void> = []
    onLoad3dReadyMock.mockImplementation((cb: (load3d: unknown) => void) => {
      onReadyCallbacks.push(cb)
    })

    const { extension } = await loadSaveMeshExtensionFresh()
    const node = makeNode({
      properties: {
        'Last Time Model File': 'sub/model.glb',
        'Last Time Model Folder': 'output'
      }
    })

    await extension.nodeCreated(node)
    expect(onReadyCallbacks).toHaveLength(1)
    expect(configureForSaveMeshMock).not.toHaveBeenCalled()

    const fakeLoad3d = { whenLoadIdle: () => Promise.resolve() }

    onReadyCallbacks[0](fakeLoad3d)
    expect(configureForSaveMeshMock).toHaveBeenCalledTimes(1)

    onReadyCallbacks[0]({ whenLoadIdle: () => Promise.resolve() })
    expect(configureForSaveMeshMock).toHaveBeenCalledTimes(2)
  })

  it('defaults the load folder to output when only the file path is persisted', async () => {
    const { extension } = await loadSaveMeshExtensionFresh()
    const node = makeNode({
      properties: { 'Last Time Model File': 'model.glb' }
    })

    await extension.nodeCreated(node)

    expect(configureForSaveMeshMock).toHaveBeenCalledWith(
      'output',
      'model.glb',
      { silentOnNotFound: true }
    )
  })

  it('persists Last Time Model File and Folder after onExecuted', async () => {
    const { extension } = await loadSaveMeshExtensionFresh()
    const node = makeNode()

    await extension.nodeCreated(node)
    node.onExecuted!({
      '3d': [{ filename: 'mesh.glb', subfolder: 'sub', type: 'output' }]
    })

    expect(node.properties['Last Time Model File']).toBe('sub/mesh.glb')
    expect(node.properties['Last Time Model Folder']).toBe('output')
    expect(configureForSaveMeshMock).toHaveBeenCalledWith(
      'output',
      'sub/mesh.glb',
      { silentOnNotFound: true }
    )
  })

  it('does not persist anything when onExecuted has no 3d output', async () => {
    const { extension } = await loadSaveMeshExtensionFresh()
    const node = makeNode()

    await extension.nodeCreated(node)
    node.onExecuted!({})

    expect(node.properties['Last Time Model File']).toBeUndefined()
    expect(node.properties['Last Time Model Folder']).toBeUndefined()
    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('uses the persisted state from a prior run when the node is recreated', async () => {
    const { extension } = await loadSaveMeshExtensionFresh()

    const firstNode = makeNode()
    await extension.nodeCreated(firstNode)
    firstNode.onExecuted!({
      '3d': [{ filename: 'mesh.glb', subfolder: 'sub', type: 'output' }]
    })

    configureForSaveMeshMock.mockClear()
    const recreated = makeNode({ properties: { ...firstNode.properties } })
    await extension.nodeCreated(recreated)

    expect(configureForSaveMeshMock).toHaveBeenCalledWith(
      'output',
      'sub/mesh.glb',
      { silentOnNotFound: true }
    )
  })
})

describe('Comfy.SaveGLB.onNodeOutputsUpdated', () => {
  beforeEach(() => {
    waitForLoad3dMock.mockImplementation((cb: (load3d: unknown) => void) => {
      cb({
        whenLoadIdle: () => Promise.resolve(),
        captureThumbnail: vi.fn()
      })
    })
  })

  it('rehydrates a SaveGLB node from restored outputs', async () => {
    const { extension, graphTraversal } = await loadSaveMeshExtensionFresh()
    const node = makeNode()
    vi.mocked(graphTraversal.getNodeByLocatorId).mockReturnValue(node)

    extension.onNodeOutputsUpdated({
      '7': {
        '3d': [{ filename: 'mesh.glb', subfolder: 'sub', type: 'output' }]
      }
    } as never)

    const modelWidget = node.widgets!.find((w) => w.name === 'image')!
    expect(modelWidget.value).toBe('sub/mesh.glb')
    expect(node.properties['Last Time Model File']).toBe('sub/mesh.glb')
    expect(node.properties['Last Time Model Folder']).toBe('output')
    expect(configureForSaveMeshMock).toHaveBeenCalledWith(
      'output',
      'sub/mesh.glb',
      { silentOnNotFound: true }
    )
  })

  it('skips entries with no 3d output', async () => {
    const { extension, graphTraversal } = await loadSaveMeshExtensionFresh()
    const node = makeNode()
    vi.mocked(graphTraversal.getNodeByLocatorId).mockReturnValue(node)

    extension.onNodeOutputsUpdated({ '7': {} } as never)

    expect(graphTraversal.getNodeByLocatorId).not.toHaveBeenCalled()
    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('skips entries whose node is not in the active rootGraph', async () => {
    const { extension, graphTraversal } = await loadSaveMeshExtensionFresh()
    vi.mocked(graphTraversal.getNodeByLocatorId).mockReturnValue(null)

    extension.onNodeOutputsUpdated({
      '7': {
        '3d': [{ filename: 'mesh.glb', subfolder: 'sub', type: 'output' }]
      }
    } as never)

    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('skips nodes whose comfyClass is not SaveGLB', async () => {
    const { extension, graphTraversal } = await loadSaveMeshExtensionFresh()
    const node = makeNode({ comfyClass: 'Preview3D' })
    vi.mocked(graphTraversal.getNodeByLocatorId).mockReturnValue(node)

    extension.onNodeOutputsUpdated({
      '7': {
        '3d': [{ filename: 'mesh.glb', subfolder: 'sub', type: 'output' }]
      }
    } as never)

    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('does not re-apply when the same result is already loaded', async () => {
    const { extension, graphTraversal } = await loadSaveMeshExtensionFresh()
    const node = makeNode({
      properties: {
        'Last Time Model File': 'sub/mesh.glb',
        'Last Time Model Folder': 'output'
      }
    })
    ;(
      node.widgets!.find((w) => w.name === 'image') as { value: string }
    ).value = 'sub/mesh.glb'
    vi.mocked(graphTraversal.getNodeByLocatorId).mockReturnValue(node)

    extension.onNodeOutputsUpdated({
      '7': {
        '3d': [{ filename: 'mesh.glb', subfolder: 'sub', type: 'output' }]
      }
    } as never)

    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })
})
