import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CameraState } from '@/extensions/core/load3d/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyExtension } from '@/types/comfy'

const {
  registerExtensionMock,
  waitForLoad3dMock,
  onLoad3dReadyMock,
  configureMock,
  configureForSaveMeshMock,
  getLoad3dMock,
  toastAddAlertMock,
  getNodeByLocatorIdMock,
  nodeToLoad3dMap
} = vi.hoisted(() => ({
  registerExtensionMock: vi.fn(),
  waitForLoad3dMock: vi.fn(),
  onLoad3dReadyMock: vi.fn(),
  configureMock: vi.fn(),
  configureForSaveMeshMock: vi.fn(),
  getLoad3dMock: vi.fn(),
  toastAddAlertMock: vi.fn(),
  getNodeByLocatorIdMock: vi.fn(),
  nodeToLoad3dMap: new Map<object, unknown>()
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

vi.mock('@/composables/useLoad3d', () => {
  const sceneDirty = new WeakMap<LGraphNode, boolean>()
  const outputCache = new WeakMap<LGraphNode, unknown>()
  return {
    useLoad3d: () => ({
      waitForLoad3d: waitForLoad3dMock,
      onLoad3dReady: onLoad3dReadyMock
    }),
    nodeToLoad3dMap,
    markLoad3dSceneDirty: (node: LGraphNode | null) => {
      if (!node) return
      sceneDirty.set(node, true)
    },
    isLoad3dSceneDirty: (node: LGraphNode) => sceneDirty.get(node) !== false,
    getLoad3dOutputCache: (node: LGraphNode) => outputCache.get(node),
    setLoad3dOutputCache: (node: LGraphNode, value: unknown) => {
      outputCache.set(node, value)
      sceneDirty.set(node, false)
    }
  }
})

vi.mock('@/extensions/core/load3d/Load3DConfiguration', () => ({
  default: class {
    configure = configureMock
    configureForSaveMesh = configureForSaveMeshMock
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
  api: { apiURL: (p: string) => p }
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
  getCustomWidgets: () => Record<string, (node: LGraphNode) => unknown>
}

async function loadExtensionsFresh(): Promise<{
  load3DExt: ExtCreated
  preview3DExt: ExtCreated
  preview3DAdvancedExt: ExtCreated
}> {
  vi.resetModules()
  registerExtensionMock.mockClear()
  await import('@/extensions/core/load3d')
  return {
    load3DExt: registerExtensionMock.mock.calls[0][0] as ExtCreated,
    preview3DExt: registerExtensionMock.mock.calls[1][0] as ExtCreated,
    preview3DAdvancedExt: registerExtensionMock.mock.calls[2][0] as ExtCreated
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

function makePreview3DAdvancedNode(
  overrides: Partial<{
    comfyClass: string
    properties: Record<string, unknown>
    widgets: FakeWidget[]
  }> = {}
): LGraphNode {
  return {
    constructor: { comfyClass: overrides.comfyClass ?? 'Preview3DAdvanced' },
    size: [400, 550],
    setSize: vi.fn(),
    widgets: overrides.widgets ?? [{ name: 'viewport_state', value: '' }],
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
    addWidget: vi.fn(),
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
  setCameraState: ReturnType<typeof vi.fn>
  getCameraState: ReturnType<typeof vi.fn>
  getCurrentCameraType: ReturnType<typeof vi.fn>
  getModelInfo: ReturnType<typeof vi.fn>
  applyModelTransform: ReturnType<typeof vi.fn>
  isSplatModel: ReturnType<typeof vi.fn>
  forceRender: ReturnType<typeof vi.fn>
  cameraManager: { perspectiveCamera: { fov: number } }
  currentLoadGeneration: number
}

function makeLoad3dMock(): FakeLoad3d {
  return {
    whenLoadIdle: vi.fn().mockResolvedValue(undefined),
    setCameraFromMatrices: vi.fn(),
    setBackgroundImage: vi.fn(),
    setCameraState: vi.fn(),
    getCameraState: vi.fn(() => ({ position: [0, 0, 5], target: [0, 0, 0] })),
    getCurrentCameraType: vi.fn(() => 'perspective'),
    getModelInfo: vi.fn(() => null),
    applyModelTransform: vi.fn(),
    isSplatModel: vi.fn(() => false),
    forceRender: vi.fn(),
    cameraManager: { perspectiveCamera: { fov: 35 } },
    currentLoadGeneration: 0
  }
}

async function flush() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function setupBaseMocks() {
  vi.clearAllMocks()
  nodeToLoad3dMap.clear()
  waitForLoad3dMock.mockImplementation((cb: (load3d: FakeLoad3d) => void) => {
    cb(makeLoad3dMock())
  })
  onLoad3dReadyMock.mockImplementation((cb: (load3d: FakeLoad3d) => void) => {
    cb(makeLoad3dMock())
  })
}

describe('load3d module registration', () => {
  beforeEach(setupBaseMocks)

  it('registers Comfy.Load3D, Comfy.Preview3D, and Comfy.Preview3DAdvanced extensions on import', async () => {
    const { load3DExt, preview3DExt, preview3DAdvancedExt } =
      await loadExtensionsFresh()

    expect(registerExtensionMock).toHaveBeenCalledTimes(3)
    expect(load3DExt.name).toBe('Comfy.Load3D')
    expect(preview3DExt.name).toBe('Comfy.Preview3D')
    expect(preview3DAdvancedExt.name).toBe('Comfy.Preview3DAdvanced')
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

    expect(configureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        loadFolder: 'input',
        modelWidget: widgets[0],
        cameraState: undefined,
        width: widgets[1],
        height: widgets[2],
        onSceneInvalidated: expect.any(Function)
      })
    )
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

describe('Comfy.Load3D.getCustomWidgets LOAD_3D', () => {
  beforeEach(setupBaseMocks)

  it('adds upload and clear buttons when the node has a model_file widget', async () => {
    const { load3DExt } = await loadExtensionsFresh()
    const node = makeLoad3DNode()
    const addWidget = node.addWidget as ReturnType<typeof vi.fn>

    load3DExt.getCustomWidgets().LOAD_3D(node)

    const buttonNames = addWidget.mock.calls
      .filter(([type]) => type === 'button')
      .map(([, name]) => name)
    expect(buttonNames).toEqual([
      'upload 3d model',
      'upload extra resources',
      'clear'
    ])
  })

  it('skips upload and clear buttons when the node has no model_file widget (e.g. Preview3DAdvanced)', async () => {
    const { load3DExt } = await loadExtensionsFresh()
    const node = makeLoad3DNode({
      comfyClass: 'Preview3DAdvanced',
      widgets: [
        { name: 'width', value: 512 },
        { name: 'height', value: 512 },
        { name: 'image', value: '' }
      ]
    })
    const addWidget = node.addWidget as ReturnType<typeof vi.fn>

    load3DExt.getCustomWidgets().LOAD_3D(node)

    const buttonCalls = addWidget.mock.calls.filter(
      ([type]) => type === 'button'
    )
    expect(buttonCalls).toEqual([])
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

describe('Comfy.Preview3DAdvanced.nodeCreated', () => {
  beforeEach(setupBaseMocks)

  it('skips nodes whose comfyClass is not Preview3DAdvanced', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const node = makePreview3DAdvancedNode({ comfyClass: 'OtherNode' })

    await preview3DAdvancedExt.nodeCreated(node)

    expect(waitForLoad3dMock).not.toHaveBeenCalled()
    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('does not call configureForSaveMesh on creation when no Last Time Model File is persisted', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const node = makePreview3DAdvancedNode()

    await preview3DAdvancedExt.nodeCreated(node)

    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('restores via configureForSaveMesh when Last Time Model File is persisted', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const node = makePreview3DAdvancedNode({
      properties: { 'Last Time Model File': 'prev/model.glb' }
    })

    await preview3DAdvancedExt.nodeCreated(node)

    expect(configureForSaveMeshMock).toHaveBeenCalledWith(
      'temp',
      'prev/model.glb',
      { silentOnNotFound: true }
    )
  })

  it('restores the saved camera state after model load when reloading the page', async () => {
    const persistedCameraState = {
      position: [1, 2, 3],
      target: [0, 0, 0]
    } as unknown as CameraState
    const load3dInstance = makeLoad3dMock()
    onLoad3dReadyMock.mockImplementationOnce(
      (cb: (load3d: FakeLoad3d) => void) => {
        cb(load3dInstance)
      }
    )

    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const node = makePreview3DAdvancedNode({
      properties: {
        'Last Time Model File': 'prev/model.glb',
        'Camera Config': {
          cameraType: 'perspective',
          fov: 35,
          state: persistedCameraState
        }
      }
    })

    await preview3DAdvancedExt.nodeCreated(node)
    await flush()

    expect(load3dInstance.setCameraState).toHaveBeenCalledWith(
      persistedCameraState
    )
    expect(load3dInstance.forceRender).toHaveBeenCalled()
  })

  it('does not call setCameraState when no Camera Config state is persisted', async () => {
    const load3dInstance = makeLoad3dMock()
    onLoad3dReadyMock.mockImplementationOnce(
      (cb: (load3d: FakeLoad3d) => void) => {
        cb(load3dInstance)
      }
    )

    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const node = makePreview3DAdvancedNode({
      properties: { 'Last Time Model File': 'prev/model.glb' }
    })

    await preview3DAdvancedExt.nodeCreated(node)
    await flush()

    expect(load3dInstance.setCameraState).not.toHaveBeenCalled()
  })

  it('attaches a camera-only serializeValue to the viewport_state widget', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const widgets: FakeWidget[] = [{ name: 'viewport_state', value: '' }]
    const node = makePreview3DAdvancedNode({ widgets })

    await preview3DAdvancedExt.nodeCreated(node)

    expect(typeof widgets[0].serializeValue).toBe('function')
  })

  it('serializeValue returns live camera_info plus empty media fields, omitting model_3d_info when none', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const widgets: FakeWidget[] = [{ name: 'viewport_state', value: '' }]
    const node = makePreview3DAdvancedNode({ widgets })

    const load3d = makeLoad3dMock()
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    nodeToLoad3dMap.set(node, load3d)

    await preview3DAdvancedExt.nodeCreated(node)
    const payload = await widgets[0].serializeValue!()

    expect(payload).toEqual({
      image: '',
      mask: '',
      normal: '',
      camera_info: { position: [0, 0, 5], target: [0, 0, 0] },
      recording: '',
      model_3d_info: []
    })
  })

  it('serializeValue wraps a present getModelInfo result in a single-element list', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const widgets: FakeWidget[] = [{ name: 'viewport_state', value: '' }]
    const node = makePreview3DAdvancedNode({ widgets })

    const load3d = makeLoad3dMock()
    const modelInfo = {
      position: { x: 1, y: 2, z: 3 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    }
    load3d.getModelInfo = vi.fn(() => modelInfo)
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    nodeToLoad3dMap.set(node, load3d)

    await preview3DAdvancedExt.nodeCreated(node)
    const payload = (await widgets[0].serializeValue!()) as {
      model_3d_info: unknown[]
    }

    expect(payload.model_3d_info).toEqual([modelInfo])
  })

  it('onExecuted persists Last Time Model File with normalized slashes and calls configureForSaveMesh', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const node = makePreview3DAdvancedNode()

    await preview3DAdvancedExt.nodeCreated(node)
    node.onExecuted!({ result: ['sub\\nested\\mesh.glb'] })

    expect(node.properties['Last Time Model File']).toBe('sub/nested/mesh.glb')
    expect(configureForSaveMeshMock).toHaveBeenCalledWith(
      'temp',
      'sub/nested/mesh.glb',
      { silentOnNotFound: true }
    )
  })

  it('onExecuted applies the input cameraState when one is forwarded via PreviewUI3D', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    load3d.currentLoadGeneration = 5
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    const cameraState = { position: [1, 2, 3] }
    const node = makePreview3DAdvancedNode()

    await preview3DAdvancedExt.nodeCreated(node)
    node.onExecuted!({ result: ['mesh.glb', cameraState] })
    await flush()

    expect(load3d.setCameraState).toHaveBeenCalledWith(cameraState)
  })

  it('onExecuted applies the first model_3d_info entry to the viewport when present', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    load3d.currentLoadGeneration = 5
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    const transform = {
      position: { x: 1, y: 2, z: 3 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 2, y: 2, z: 2 }
    }
    const node = makePreview3DAdvancedNode()

    await preview3DAdvancedExt.nodeCreated(node)
    node.onExecuted!({
      result: ['mesh.glb', undefined, [transform]]
    })
    await flush()

    expect(load3d.applyModelTransform).toHaveBeenCalledWith(transform)
  })

  it('onExecuted does not call applyModelTransform when model_3d_info is empty', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    const node = makePreview3DAdvancedNode()

    await preview3DAdvancedExt.nodeCreated(node)
    node.onExecuted!({
      result: ['mesh.glb', undefined, []]
    })
    await flush()

    expect(load3d.applyModelTransform).not.toHaveBeenCalled()
  })

  it('onExecuted defensively skips cameraState apply when result[1] is missing', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    const node = makePreview3DAdvancedNode()

    await preview3DAdvancedExt.nodeCreated(node)
    node.onExecuted!({ result: ['mesh.glb'] })
    await flush()

    expect(load3d.setCameraState).not.toHaveBeenCalled()
  })

  it('onExecuted skips cameraState apply when load3d generation changes before whenLoadIdle resolves', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
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

    const node = makePreview3DAdvancedNode()

    await preview3DAdvancedExt.nodeCreated(node)
    node.onExecuted!({ result: ['mesh.glb', { position: [1, 2, 3] }] })

    load3d.currentLoadGeneration = 6
    resolveIdle()
    await flush()

    expect(load3d.setCameraState).not.toHaveBeenCalled()
  })

  it('onExecuted shows an error toast when no file path is returned', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const node = makePreview3DAdvancedNode()

    await preview3DAdvancedExt.nodeCreated(node)
    node.onExecuted!({ result: [] })

    expect(toastAddAlertMock).toHaveBeenCalledWith(
      'toastMessages.unableToGetModelFilePath'
    )
    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })
})

describe('Comfy.Preview3DAdvanced.getNodeMenuItems', () => {
  beforeEach(setupBaseMocks)

  it('returns [] for non-Preview3DAdvanced nodes', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    const node = {
      constructor: { comfyClass: 'OtherNode' }
    } as unknown as LGraphNode

    expect(preview3DAdvancedExt.getNodeMenuItems(node)).toEqual([])
  })

  it('returns [] when no load3d instance exists for the node', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    getLoad3dMock.mockReturnValue(null)
    const node = {
      constructor: { comfyClass: 'Preview3DAdvanced' }
    } as unknown as LGraphNode

    expect(preview3DAdvancedExt.getNodeMenuItems(node)).toEqual([])
  })

  it('returns [] for splat models', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    getLoad3dMock.mockReturnValue({ isSplatModel: () => true })
    const node = {
      constructor: { comfyClass: 'Preview3DAdvanced' }
    } as unknown as LGraphNode

    expect(preview3DAdvancedExt.getNodeMenuItems(node)).toEqual([])
  })

  it('returns export menu items for non-splat models', async () => {
    const { preview3DAdvancedExt } = await loadExtensionsFresh()
    getLoad3dMock.mockReturnValue({ isSplatModel: () => false })
    const node = {
      constructor: { comfyClass: 'Preview3DAdvanced' }
    } as unknown as LGraphNode

    expect(preview3DAdvancedExt.getNodeMenuItems(node)).toEqual([
      { content: 'Export' }
    ])
  })
})

describe('Comfy.Load3D scene widget serializeValue caching', () => {
  beforeEach(setupBaseMocks)

  function makeFullFakeLoad3d() {
    return {
      getCurrentCameraType: vi.fn(() => 'perspective'),
      cameraManager: { perspectiveCamera: { fov: 35 } },
      getCameraState: vi.fn(() => ({ position: { x: 0, y: 0, z: 0 } })),
      stopRecording: vi.fn(),
      captureScene: vi.fn(async () => ({
        scene: 'scene-data',
        mask: 'mask-data',
        normal: 'normal-data'
      })),
      handleResize: vi.fn(),
      getModelInfo: vi.fn(() => null),
      getRecordingData: vi.fn(() => null)
    }
  }

  async function setup() {
    const { load3DExt } = await loadExtensionsFresh()
    const useLoad3dModule = await import('@/composables/useLoad3d')
    const utilsModule = await import('@/extensions/core/load3d/Load3dUtils')
    const uploadTempImage = utilsModule.default.uploadTempImage as ReturnType<
      typeof vi.fn
    >
    let counter = 0
    uploadTempImage.mockImplementation(
      async (_data: unknown, kind: string) => ({
        name: `${kind}-${++counter}.png`
      })
    )

    const widgets: FakeWidget[] = [
      { name: 'model_file', value: 'm.glb' },
      { name: 'width', value: 256 },
      { name: 'height', value: 256 },
      { name: 'image', value: '' }
    ]
    const node = makeLoad3DNode({ widgets, properties: {} })
    useLoad3dModule.nodeToLoad3dMap.set(node, makeFullFakeLoad3d() as never)

    await load3DExt.nodeCreated(node)
    const serialize = widgets[3].serializeValue! as () => Promise<{
      image: string
    } | null>

    return { node, serialize, uploadTempImage, useLoad3dModule }
  }

  it('reuses the cached output when the scene has not been dirtied', async () => {
    const { node, serialize, uploadTempImage, useLoad3dModule } = await setup()

    const first = await serialize()
    expect(uploadTempImage).toHaveBeenCalledTimes(3)
    expect(first?.image).toBe('threed/scene-1.png [temp]')
    expect(useLoad3dModule.isLoad3dSceneDirty(node)).toBe(false)
    expect(useLoad3dModule.getLoad3dOutputCache(node)).toBe(first)

    const second = await serialize()
    expect(uploadTempImage).toHaveBeenCalledTimes(3)
    expect(second).toBe(first)
  })

  it('re-captures after the scene is marked dirty', async () => {
    const { node, serialize, uploadTempImage, useLoad3dModule } = await setup()

    await serialize()
    expect(uploadTempImage).toHaveBeenCalledTimes(3)

    useLoad3dModule.markLoad3dSceneDirty(node)

    const refreshed = await serialize()
    expect(uploadTempImage).toHaveBeenCalledTimes(6)
    expect(refreshed?.image).toBe('threed/scene-4.png [temp]')
  })

  it('returns null when no load3d instance is registered for the node', async () => {
    const { load3DExt } = await loadExtensionsFresh()
    const widgets: FakeWidget[] = [
      { name: 'model_file', value: 'm.glb' },
      { name: 'width', value: 256 },
      { name: 'height', value: 256 },
      { name: 'image', value: '' }
    ]
    const node = makeLoad3DNode({ widgets })
    await load3DExt.nodeCreated(node)
    expect(await widgets[3].serializeValue!()).toBeNull()
  })
})
