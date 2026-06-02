import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyExtension } from '@/types/comfy'

const {
  registerExtensionMock,
  waitForLoad3dMock,
  onLoad3dReadyMock,
  configureForSaveMeshMock,
  getNodeByLocatorIdMock
} = vi.hoisted(() => ({
  registerExtensionMock: vi.fn(),
  waitForLoad3dMock: vi.fn(),
  onLoad3dReadyMock: vi.fn(),
  configureForSaveMeshMock: vi.fn(),
  getNodeByLocatorIdMock: vi.fn()
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({ registerExtension: registerExtensionMock })
}))

vi.mock('@/services/load3dService', () => ({
  useLoad3dService: () => ({ getLoad3d: vi.fn() })
}))

vi.mock('@/composables/useLoad3d', () => ({
  useLoad3d: () => ({
    waitForLoad3d: waitForLoad3dMock,
    onLoad3dReady: onLoad3dReadyMock
  })
}))

vi.mock('@/extensions/core/load3d/Load3DConfiguration', () => ({
  default: class {
    configureForSaveMesh = configureForSaveMeshMock
  }
}))

vi.mock('@/extensions/core/load3d/exportMenuHelper', () => ({
  createExportMenuItems: vi.fn(() => [])
}))

vi.mock('@/components/load3d/Load3D.vue', () => ({ default: {} }))

vi.mock('@/scripts/domWidget', () => ({
  ComponentWidgetImpl: vi.fn(),
  addWidget: vi.fn()
}))

vi.mock('@/platform/assets/utils/assetPreviewUtil', () => ({
  isAssetPreviewSupported: vi.fn(() => false),
  persistThumbnail: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: {} }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: getNodeByLocatorIdMock
}))

type SaveMeshExtension = ComfyExtension & {
  nodeCreated: (node: LGraphNode) => Promise<void>
  onNodeOutputsUpdated: (
    nodeOutputs: Record<string, Record<string, unknown>>
  ) => void
}

async function loadSaveMeshExtensionFresh(): Promise<SaveMeshExtension> {
  vi.resetModules()
  registerExtensionMock.mockClear()
  await import('@/extensions/core/saveMesh')
  return registerExtensionMock.mock.calls[0][0] as SaveMeshExtension
}

function makeNode(
  overrides: Partial<{
    comfyClass: string
    properties: Record<string, unknown>
  }> = {}
): LGraphNode {
  const { comfyClass = 'SaveGLB', properties = {} } = overrides
  return {
    constructor: { comfyClass },
    size: [400, 550],
    setSize: vi.fn(),
    widgets: [{ name: 'image', value: '' }],
    properties
  } as unknown as LGraphNode
}

describe('saveMesh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    const ext = await loadSaveMeshExtensionFresh()

    expect(registerExtensionMock).toHaveBeenCalledOnce()
    expect(ext.name).toBe('Comfy.SaveGLB')
    expect(typeof ext.nodeCreated).toBe('function')
  })

  it('skips nodes whose comfyClass is not SaveGLB', async () => {
    const ext = await loadSaveMeshExtensionFresh()
    const node = makeNode({ comfyClass: 'OtherNode' })

    await ext.nodeCreated(node)

    expect(waitForLoad3dMock).not.toHaveBeenCalled()
    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('does not load a model on creation when no Last Time Model File is persisted', async () => {
    const ext = await loadSaveMeshExtensionFresh()
    const node = makeNode()

    await ext.nodeCreated(node)

    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('restores the persisted model on creation using the persisted folder', async () => {
    const ext = await loadSaveMeshExtensionFresh()
    const node = makeNode({
      properties: {
        'Last Time Model File': 'sub/model.glb',
        'Last Time Model Folder': 'output'
      }
    })

    await ext.nodeCreated(node)

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

    const ext = await loadSaveMeshExtensionFresh()
    const node = makeNode({
      properties: {
        'Last Time Model File': 'sub/model.glb',
        'Last Time Model Folder': 'output'
      }
    })

    await ext.nodeCreated(node)
    expect(onReadyCallbacks).toHaveLength(1)
    expect(configureForSaveMeshMock).not.toHaveBeenCalled()

    const fakeLoad3d = { whenLoadIdle: () => Promise.resolve() }

    onReadyCallbacks[0](fakeLoad3d)
    expect(configureForSaveMeshMock).toHaveBeenCalledTimes(1)

    onReadyCallbacks[0]({ whenLoadIdle: () => Promise.resolve() })
    expect(configureForSaveMeshMock).toHaveBeenCalledTimes(2)
  })

  it('defaults the load folder to output when only the file path is persisted', async () => {
    const ext = await loadSaveMeshExtensionFresh()
    const node = makeNode({
      properties: { 'Last Time Model File': 'model.glb' }
    })

    await ext.nodeCreated(node)

    expect(configureForSaveMeshMock).toHaveBeenCalledWith(
      'output',
      'model.glb',
      { silentOnNotFound: true }
    )
  })

  it('persists Last Time Model File and Folder after onExecuted', async () => {
    const ext = await loadSaveMeshExtensionFresh()
    const node = makeNode()

    await ext.nodeCreated(node)
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
    const ext = await loadSaveMeshExtensionFresh()
    const node = makeNode()

    await ext.nodeCreated(node)
    node.onExecuted!({})

    expect(node.properties['Last Time Model File']).toBeUndefined()
    expect(node.properties['Last Time Model Folder']).toBeUndefined()
    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('uses the persisted state from a prior run when the node is recreated', async () => {
    const ext = await loadSaveMeshExtensionFresh()

    const firstNode = makeNode()
    await ext.nodeCreated(firstNode)
    firstNode.onExecuted!({
      '3d': [{ filename: 'mesh.glb', subfolder: 'sub', type: 'output' }]
    })

    configureForSaveMeshMock.mockClear()
    const recreated = makeNode({ properties: { ...firstNode.properties } })
    await ext.nodeCreated(recreated)

    expect(configureForSaveMeshMock).toHaveBeenCalledWith(
      'output',
      'sub/mesh.glb',
      { silentOnNotFound: true }
    )
  })
})

describe('Comfy.SaveGLB.onNodeOutputsUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    waitForLoad3dMock.mockImplementation((cb: (load3d: unknown) => void) => {
      cb({
        whenLoadIdle: () => Promise.resolve(),
        captureThumbnail: vi.fn()
      })
    })
  })

  it('rehydrates a SaveGLB node from restored outputs', async () => {
    const ext = await loadSaveMeshExtensionFresh()
    const node = makeNode()
    getNodeByLocatorIdMock.mockReturnValue(node)

    ext.onNodeOutputsUpdated!({
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
    const ext = await loadSaveMeshExtensionFresh()
    const node = makeNode()
    getNodeByLocatorIdMock.mockReturnValue(node)

    ext.onNodeOutputsUpdated!({ '7': {} } as never)

    expect(getNodeByLocatorIdMock).not.toHaveBeenCalled()
    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('skips entries whose node is not in the active rootGraph', async () => {
    const ext = await loadSaveMeshExtensionFresh()
    getNodeByLocatorIdMock.mockReturnValue(null)

    ext.onNodeOutputsUpdated!({
      '7': {
        '3d': [{ filename: 'mesh.glb', subfolder: 'sub', type: 'output' }]
      }
    } as never)

    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('skips nodes whose comfyClass is not SaveGLB', async () => {
    const ext = await loadSaveMeshExtensionFresh()
    const node = makeNode({ comfyClass: 'Preview3D' })
    getNodeByLocatorIdMock.mockReturnValue(node)

    ext.onNodeOutputsUpdated!({
      '7': {
        '3d': [{ filename: 'mesh.glb', subfolder: 'sub', type: 'output' }]
      }
    } as never)

    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('does not re-apply when the same result is already loaded', async () => {
    const ext = await loadSaveMeshExtensionFresh()
    const node = makeNode({
      properties: {
        'Last Time Model File': 'sub/mesh.glb',
        'Last Time Model Folder': 'output'
      }
    })
    ;(
      node.widgets!.find((w) => w.name === 'image') as { value: string }
    ).value = 'sub/mesh.glb'
    getNodeByLocatorIdMock.mockReturnValue(node)

    ext.onNodeOutputsUpdated!({
      '7': {
        '3d': [{ filename: 'mesh.glb', subfolder: 'sub', type: 'output' }]
      }
    } as never)

    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })
})
