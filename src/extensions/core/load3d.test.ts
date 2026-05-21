import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyExtension } from '@/types/comfy'

const {
  registerExtensionMock,
  waitForLoad3dMock,
  onLoad3dReadyMock,
  configureMock,
  getLoad3dMock,
  toastAddAlertMock,
  getNodeByLocatorIdMock
} = vi.hoisted(() => ({
  registerExtensionMock: vi.fn(),
  waitForLoad3dMock: vi.fn(),
  onLoad3dReadyMock: vi.fn(),
  configureMock: vi.fn(),
  getLoad3dMock: vi.fn(),
  toastAddAlertMock: vi.fn(),
  getNodeByLocatorIdMock: vi.fn()
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({ registerExtension: registerExtensionMock })
}))

vi.mock('@/services/load3dService', () => ({
  useLoad3dService: () => ({
    getLoad3d: getLoad3dMock,
    handleViewerClose: vi.fn()
  })
}))

vi.mock('@/composables/useLoad3d', () => ({
  useLoad3d: () => ({
    waitForLoad3d: waitForLoad3dMock,
    onLoad3dReady: onLoad3dReadyMock
  }),
  nodeToLoad3dMap: new Map()
}))

vi.mock('@/extensions/core/load3d/Load3DConfiguration', () => ({
  default: class {
    configure = configureMock
  }
}))

vi.mock('@/extensions/core/load3d/exportMenuHelper', () => ({
  createExportMenuItems: vi.fn(() => [{ content: 'Export' }])
}))

vi.mock('@/extensions/core/load3d/Load3dUtils', () => ({
  default: {
    splitFilePath: vi.fn((p: string) => ['', p]),
    getResourceURL: vi.fn(() => '/view'),
    uploadFile: vi.fn(),
    uploadMultipleFiles: vi.fn(),
    uploadTempImage: vi.fn()
  }
}))

vi.mock('@/extensions/core/load3d/constants', () => ({
  SUPPORTED_EXTENSIONS_ACCEPT: '.glb,.gltf'
}))

vi.mock('@/components/load3d/Load3D.vue', () => ({ default: {} }))
vi.mock('@/components/load3d/Load3dViewerContent.vue', () => ({ default: {} }))

vi.mock('@/scripts/domWidget', () => ({
  ComponentWidgetImpl: vi.fn(),
  addWidget: vi.fn()
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (p: string) => p,
    addEventListener: vi.fn(),
    addCustomEventListener: vi.fn(),
    fetchApi: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: { selected_nodes: {} }, rootGraph: {} },
  ComfyApp: { copyToClipspace: vi.fn(), clipspace_return_node: null }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: getNodeByLocatorIdMock
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert: toastAddAlertMock })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog: vi.fn() })
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLoad3dNode: vi.fn(() => true)
}))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LiteGraph: { ContextMenu: vi.fn() }
}))

type ExtCreated = ComfyExtension & {
  nodeCreated: (node: LGraphNode) => Promise<void>
  beforeRegisterNodeDef: (
    nodeType: typeof LGraphNode,
    nodeData: ComfyNodeDef
  ) => Promise<void>
  getNodeMenuItems: (node: LGraphNode) => unknown[]
  onNodeOutputsUpdated: (
    nodeOutputs: Record<string, Record<string, unknown>>
  ) => void
}

async function loadExtensionsFresh(): Promise<{
  load3DExt: ExtCreated
  preview3DExt: ExtCreated
}> {
  vi.resetModules()
  registerExtensionMock.mockClear()
  await import('@/extensions/core/load3d')
  return {
    load3DExt: registerExtensionMock.mock.calls[0][0] as ExtCreated,
    preview3DExt: registerExtensionMock.mock.calls[1][0] as ExtCreated
  }
}

interface FakeWidget {
  name: string
  value: unknown
  serializeValue?: () => Promise<unknown>
}

function makePreview3DNode(
  overrides: Partial<{
    comfyClass: string
    properties: Record<string, unknown>
    widgets: FakeWidget[]
  }> = {}
): LGraphNode {
  return {
    constructor: { comfyClass: overrides.comfyClass ?? 'Preview3D' },
    size: [400, 550],
    setSize: vi.fn(),
    widgets: overrides.widgets ?? [{ name: 'model_file', value: '' }],
    properties: overrides.properties ?? {}
  } as unknown as LGraphNode
}

function makeLoad3DNode(
  overrides: Partial<{
    comfyClass: string
    properties: Record<string, unknown>
    widgets: FakeWidget[]
  }> = {}
): LGraphNode {
  return {
    constructor: { comfyClass: overrides.comfyClass ?? 'Load3D' },
    size: [300, 600],
    setSize: vi.fn(),
    widgets: overrides.widgets ?? [
      { name: 'model_file', value: '' },
      { name: 'width', value: 512 },
      { name: 'height', value: 512 },
      { name: 'image', value: '' }
    ],
    properties: overrides.properties ?? {}
  } as unknown as LGraphNode
}

interface FakeLoad3d {
  whenLoadIdle: () => Promise<void>
  setCameraFromMatrices: ReturnType<typeof vi.fn>
  setBackgroundImage: ReturnType<typeof vi.fn>
  isSplatModel: ReturnType<typeof vi.fn>
  currentLoadGeneration: number
}

function makeLoad3dMock(): FakeLoad3d {
  return {
    whenLoadIdle: vi.fn().mockResolvedValue(undefined),
    setCameraFromMatrices: vi.fn(),
    setBackgroundImage: vi.fn(),
    isSplatModel: vi.fn(() => false),
    currentLoadGeneration: 0
  }
}

async function flush() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function setupBaseMocks() {
  vi.clearAllMocks()
  waitForLoad3dMock.mockImplementation((cb: (load3d: FakeLoad3d) => void) => {
    cb(makeLoad3dMock())
  })
  onLoad3dReadyMock.mockImplementation((cb: (load3d: FakeLoad3d) => void) => {
    cb(makeLoad3dMock())
  })
}

describe('load3d module registration', () => {
  beforeEach(setupBaseMocks)

  it('registers Comfy.Load3D and Comfy.Preview3D extensions on import', async () => {
    const { load3DExt, preview3DExt } = await loadExtensionsFresh()

    expect(registerExtensionMock).toHaveBeenCalledTimes(2)
    expect(load3DExt.name).toBe('Comfy.Load3D')
    expect(preview3DExt.name).toBe('Comfy.Preview3D')
  })
})

describe('Comfy.Preview3D.beforeRegisterNodeDef', () => {
  beforeEach(setupBaseMocks)

  it('rewrites the image input spec for Preview3D nodes', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const nodeData = {
      name: 'Preview3D',
      input: { required: { image: ['STRING', {}] } }
    } as unknown as ComfyNodeDef

    await preview3DExt.beforeRegisterNodeDef({} as typeof LGraphNode, nodeData)

    expect(nodeData.input!.required!.image).toEqual(['PREVIEW_3D'])
  })

  it('leaves non-Preview3D node defs unchanged', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const nodeData = {
      name: 'Load3D',
      input: { required: { image: ['STRING', {}] } }
    } as unknown as ComfyNodeDef

    await preview3DExt.beforeRegisterNodeDef({} as typeof LGraphNode, nodeData)

    expect(nodeData.input!.required!.image).toEqual(['STRING', {}])
  })
})

describe('Comfy.Preview3D.nodeCreated', () => {
  beforeEach(setupBaseMocks)

  it('skips nodes whose comfyClass is not Preview3D', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const node = makePreview3DNode({ comfyClass: 'OtherNode' })

    await preview3DExt.nodeCreated(node)

    expect(waitForLoad3dMock).not.toHaveBeenCalled()
    expect(configureMock).not.toHaveBeenCalled()
  })

  it('does not configure on creation when no Last Time Model File is persisted', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const node = makePreview3DNode()

    await preview3DExt.nodeCreated(node)

    expect(configureMock).not.toHaveBeenCalled()
  })

  it('restores via configure with persisted cameraState when Last Time Model File is set', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const cameraState = { position: [1, 2, 3] }
    const node = makePreview3DNode({
      properties: {
        'Last Time Model File': 'prev/model.glb',
        'Camera Config': { cameraType: 'perspective', state: cameraState }
      }
    })

    await preview3DExt.nodeCreated(node)

    expect(configureMock).toHaveBeenCalledWith({
      loadFolder: 'output',
      modelWidget: expect.objectContaining({ value: 'prev/model.glb' }),
      cameraState,
      silentOnNotFound: true
    })
  })

  it('registers a persistent onLoad3dReady hook so subgraph re-entry rehydrates the model', async () => {
    const onReadyCallbacks: Array<(load3d: FakeLoad3d) => void> = []
    onLoad3dReadyMock.mockImplementation((cb: (load3d: FakeLoad3d) => void) => {
      onReadyCallbacks.push(cb)
    })

    const { preview3DExt } = await loadExtensionsFresh()
    const node = makePreview3DNode({
      properties: { 'Last Time Model File': 'persisted/model.glb' }
    })

    await preview3DExt.nodeCreated(node)
    expect(onReadyCallbacks).toHaveLength(1)
    expect(configureMock).not.toHaveBeenCalled()

    // First mount.
    onReadyCallbacks[0](makeLoad3dMock())
    expect(configureMock).toHaveBeenCalledTimes(1)

    // Subgraph exit + re-entry: same callback fires again with a fresh load3d.
    onReadyCallbacks[0](makeLoad3dMock())
    expect(configureMock).toHaveBeenCalledTimes(2)
  })

  it('persists Last Time Model File and normalizes backslashes after onExecuted', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const node = makePreview3DNode()

    await preview3DExt.nodeCreated(node)
    node.onExecuted!({ result: ['sub\\nested\\mesh.glb'] })

    expect(node.properties['Last Time Model File']).toBe('sub/nested/mesh.glb')
    expect(configureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        loadFolder: 'output',
        silentOnNotFound: true
      })
    )
  })

  it('forwards bgImagePath to load3d.setBackgroundImage on execute', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    const node = makePreview3DNode()

    await preview3DExt.nodeCreated(node)
    node.onExecuted!({ result: ['mesh.glb', undefined, 'bg.png'] })

    expect(load3d.setBackgroundImage).toHaveBeenCalledWith('bg.png')
  })

  it('applies camera matrices when load3d generation is unchanged', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    load3d.currentLoadGeneration = 5
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    const extrinsics = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ]
    const intrinsics = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ]

    const node = makePreview3DNode()
    await preview3DExt.nodeCreated(node)
    node.onExecuted!({
      result: ['mesh.glb', undefined, undefined, extrinsics, intrinsics]
    })
    await flush()

    expect(load3d.setCameraFromMatrices).toHaveBeenCalledWith(
      extrinsics,
      intrinsics
    )
  })

  it('skips camera matrix application when load3d generation changes before whenLoadIdle resolves', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    load3d.currentLoadGeneration = 5
    let resolveIdle: () => void = () => {}
    load3d.whenLoadIdle = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveIdle = resolve
        })
    )
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )

    const node = makePreview3DNode()
    await preview3DExt.nodeCreated(node)
    node.onExecuted!({
      result: ['mesh.glb', undefined, undefined, [[1]], [[1]]]
    })

    load3d.currentLoadGeneration = 6
    resolveIdle()
    await flush()

    expect(load3d.setCameraFromMatrices).not.toHaveBeenCalled()
  })

  it('shows an error toast when onExecuted has no file path', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const node = makePreview3DNode()

    await preview3DExt.nodeCreated(node)
    node.onExecuted!({ result: [] })

    expect(toastAddAlertMock).toHaveBeenCalledWith(
      'toastMessages.unableToGetModelFilePath'
    )
  })
})

describe('Comfy.Load3D.nodeCreated', () => {
  beforeEach(setupBaseMocks)

  it('skips nodes whose comfyClass is not Load3D', async () => {
    const { load3DExt } = await loadExtensionsFresh()
    const node = makeLoad3DNode({ comfyClass: 'OtherNode' })

    await load3DExt.nodeCreated(node)

    expect(waitForLoad3dMock).not.toHaveBeenCalled()
  })

  it('configures with the input folder and width/height widgets', async () => {
    const { load3DExt } = await loadExtensionsFresh()
    const widgets: FakeWidget[] = [
      { name: 'model_file', value: 'model.glb' },
      { name: 'width', value: 1024 },
      { name: 'height', value: 768 },
      { name: 'image', value: '' }
    ]
    const node = makeLoad3DNode({ widgets })

    await load3DExt.nodeCreated(node)

    expect(configureMock).toHaveBeenCalledWith({
      loadFolder: 'input',
      modelWidget: widgets[0],
      cameraState: undefined,
      width: widgets[1],
      height: widgets[2]
    })
  })

  it('attaches a serializeValue function to the scene widget', async () => {
    const { load3DExt } = await loadExtensionsFresh()
    const widgets: FakeWidget[] = [
      { name: 'model_file', value: '' },
      { name: 'width', value: 512 },
      { name: 'height', value: 512 },
      { name: 'image', value: '' }
    ]
    const node = makeLoad3DNode({ widgets })

    await load3DExt.nodeCreated(node)

    expect(typeof widgets[3].serializeValue).toBe('function')
  })

  it('skips configure when required widgets are missing', async () => {
    const { load3DExt } = await loadExtensionsFresh()
    const node = makeLoad3DNode({
      widgets: [{ name: 'model_file', value: '' }]
    })

    await load3DExt.nodeCreated(node)

    expect(configureMock).not.toHaveBeenCalled()
  })
})

describe('getNodeMenuItems', () => {
  beforeEach(setupBaseMocks)

  it('Comfy.Load3D returns [] for non-Load3D nodes', async () => {
    const { load3DExt } = await loadExtensionsFresh()
    const node = {
      constructor: { comfyClass: 'OtherNode' }
    } as unknown as LGraphNode

    expect(load3DExt.getNodeMenuItems(node)).toEqual([])
  })

  it('Comfy.Preview3D returns [] for non-Preview3D nodes', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const node = {
      constructor: { comfyClass: 'OtherNode' }
    } as unknown as LGraphNode

    expect(preview3DExt.getNodeMenuItems(node)).toEqual([])
  })

  it('returns [] when no load3d instance exists for the node', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    getLoad3dMock.mockReturnValue(null)
    const node = {
      constructor: { comfyClass: 'Preview3D' }
    } as unknown as LGraphNode

    expect(preview3DExt.getNodeMenuItems(node)).toEqual([])
  })

  it('returns [] for splat models', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    getLoad3dMock.mockReturnValue({ isSplatModel: () => true })
    const node = {
      constructor: { comfyClass: 'Preview3D' }
    } as unknown as LGraphNode

    expect(preview3DExt.getNodeMenuItems(node)).toEqual([])
  })

  it('returns export menu items for non-splat 3D nodes', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    getLoad3dMock.mockReturnValue({ isSplatModel: () => false })
    const node = {
      constructor: { comfyClass: 'Preview3D' }
    } as unknown as LGraphNode

    expect(preview3DExt.getNodeMenuItems(node)).toEqual([{ content: 'Export' }])
  })
})

describe('Comfy.Preview3D.onNodeOutputsUpdated', () => {
  beforeEach(setupBaseMocks)

  it('rehydrates a Preview3D node from restored outputs', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const node = makePreview3DNode()
    getNodeByLocatorIdMock.mockReturnValue(node)

    preview3DExt.onNodeOutputsUpdated!({
      '7': { result: ['sub\\nested\\mesh.glb', { position: [1, 2, 3] }] }
    } as never)

    const modelWidget = node.widgets!.find((w) => w.name === 'model_file')!
    expect(modelWidget.value).toBe('sub/nested/mesh.glb')
    expect(node.properties['Last Time Model File']).toBe('sub/nested/mesh.glb')
    expect(configureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        loadFolder: 'output',
        cameraState: { position: [1, 2, 3] },
        silentOnNotFound: true
      })
    )
  })

  it('skips entries with no result file path', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const node = makePreview3DNode()
    getNodeByLocatorIdMock.mockReturnValue(node)

    preview3DExt.onNodeOutputsUpdated!({
      '7': { result: [undefined] }
    } as never)

    expect(getNodeByLocatorIdMock).not.toHaveBeenCalled()
    expect(configureMock).not.toHaveBeenCalled()
  })

  it('skips entries whose node is not in the active rootGraph', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    getNodeByLocatorIdMock.mockReturnValue(null)

    preview3DExt.onNodeOutputsUpdated!({
      '7': { result: ['mesh.glb'] }
    } as never)

    expect(configureMock).not.toHaveBeenCalled()
  })

  it('skips nodes whose comfyClass is not Preview3D', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const node = makePreview3DNode({ comfyClass: 'Load3D' })
    getNodeByLocatorIdMock.mockReturnValue(node)

    preview3DExt.onNodeOutputsUpdated!({
      '7': { result: ['mesh.glb'] }
    } as never)

    expect(configureMock).not.toHaveBeenCalled()
  })

  it('re-applies even when the file path is unchanged so camera/bg updates do not get dropped', async () => {
    const { preview3DExt } = await loadExtensionsFresh()
    const node = makePreview3DNode({
      properties: { 'Last Time Model File': 'mesh.glb' },
      widgets: [{ name: 'model_file', value: 'mesh.glb' }]
    })
    getNodeByLocatorIdMock.mockReturnValue(node)

    preview3DExt.onNodeOutputsUpdated!({
      '7': {
        result: ['mesh.glb', { position: [9, 9, 9] }, 'new-bg.png']
      }
    } as never)

    expect(configureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cameraState: { position: [9, 9, 9] },
        bgImagePath: 'new-bg.png'
      })
    )
  })
})
