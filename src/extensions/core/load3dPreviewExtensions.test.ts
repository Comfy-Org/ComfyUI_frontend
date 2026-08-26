import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyExtension } from '@/types/comfy'

const {
  registerExtensionMock,
  waitForLoad3dMock,
  onLoad3dReadyMock,
  configureForSaveMeshMock,
  getLoad3dMock,
  toastAddAlertMock,
  getNodeByLocatorIdMock,
  nodeToLoad3dMapMock
} = vi.hoisted(() => ({
  registerExtensionMock: vi.fn(),
  waitForLoad3dMock: vi.fn(),
  onLoad3dReadyMock: vi.fn(),
  configureForSaveMeshMock: vi.fn(),
  getLoad3dMock: vi.fn(),
  toastAddAlertMock: vi.fn(),
  getNodeByLocatorIdMock: vi.fn(),
  nodeToLoad3dMapMock: new Map()
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({ registerExtension: registerExtensionMock })
}))

vi.mock('@/services/load3dService', () => ({
  useLoad3dService: () => ({ getLoad3d: getLoad3dMock })
}))

vi.mock('@/composables/useLoad3d', () => ({
  useLoad3d: () => ({
    waitForLoad3d: waitForLoad3dMock,
    onLoad3dReady: onLoad3dReadyMock
  }),
  nodeToLoad3dMap: nodeToLoad3dMapMock
}))

vi.mock('@/extensions/core/load3d/Load3DConfiguration', () => ({
  default: class {
    configureForSaveMesh = configureForSaveMeshMock
  }
}))

vi.mock('@/extensions/core/load3d/exportMenuHelper', () => ({
  createExportMenuItems: vi.fn(() => [{ content: 'Export' }])
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: {} }
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

type ExtCreated = ComfyExtension & {
  nodeCreated: (node: LGraphNode) => Promise<void>
  getNodeMenuItems: (node: LGraphNode) => unknown[]
  onNodeOutputsUpdated: (
    nodeOutputs: Record<string, Record<string, unknown>>
  ) => void
}

async function loadExtensionsFresh(): Promise<{
  splatExt: ExtCreated
  pointCloudExt: ExtCreated
  saveSplatExt: ExtCreated
  savePointCloudExt: ExtCreated
}> {
  vi.resetModules()
  registerExtensionMock.mockClear()
  await import('@/extensions/core/load3dPreviewExtensions')
  const extByName = (name: string): ExtCreated => {
    const call = registerExtensionMock.mock.calls.find(
      (c) => (c[0] as ExtCreated).name === name
    )
    if (!call) throw new Error(`Extension ${name} was not registered`)
    return call[0] as ExtCreated
  }
  return {
    splatExt: extByName('Comfy.PreviewGaussianSplat'),
    pointCloudExt: extByName('Comfy.PreviewPointCloud'),
    saveSplatExt: extByName('Comfy.SaveGaussianSplat'),
    savePointCloudExt: extByName('Comfy.SavePointCloud')
  }
}

interface FakeLoad3d {
  whenLoadIdle: () => Promise<void>
  isSplatModel: ReturnType<typeof vi.fn>
  forceRender: ReturnType<typeof vi.fn>
  setCameraState: ReturnType<typeof vi.fn>
  applyModelTransform: ReturnType<typeof vi.fn>
  setTargetSize: ReturnType<typeof vi.fn>
  getCurrentCameraType: ReturnType<typeof vi.fn>
  getCameraState: ReturnType<typeof vi.fn>
  getModelInfo: ReturnType<typeof vi.fn>
  cameraManager: { perspectiveCamera: { fov: number } }
  currentLoadGeneration: number
}

function makeLoad3dMock(): FakeLoad3d {
  return {
    whenLoadIdle: vi.fn().mockResolvedValue(undefined),
    isSplatModel: vi.fn(() => false),
    forceRender: vi.fn(),
    setCameraState: vi.fn(),
    applyModelTransform: vi.fn(),
    setTargetSize: vi.fn(),
    getCurrentCameraType: vi.fn(() => 'perspective'),
    getCameraState: vi.fn(() => ({ position: { x: 0, y: 0, z: 0 } })),
    getModelInfo: vi.fn(() => null),
    cameraManager: { perspectiveCamera: { fov: 75 } },
    currentLoadGeneration: 0
  }
}

interface FakeWidget {
  name: string
  value: unknown
}

function makePreviewNode(
  overrides: Partial<{
    comfyClass: string
    properties: Record<string, unknown>
    widgets: FakeWidget[]
  }> = {}
): LGraphNode {
  return {
    constructor: {
      comfyClass: overrides.comfyClass ?? 'PreviewGaussianSplat'
    },
    size: [400, 550],
    setSize: vi.fn(),
    widgets: overrides.widgets ?? [{ name: 'model_file', value: '' }],
    properties: overrides.properties ?? {}
  } as unknown as LGraphNode
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

describe('load3dPreviewExtensions module registration', () => {
  beforeEach(setupBaseMocks)

  it('registers preview and save extensions on import', async () => {
    const { splatExt, pointCloudExt, saveSplatExt, savePointCloudExt } =
      await loadExtensionsFresh()

    expect(registerExtensionMock).toHaveBeenCalledTimes(4)
    expect(splatExt.name).toBe('Comfy.PreviewGaussianSplat')
    expect(pointCloudExt.name).toBe('Comfy.PreviewPointCloud')
    expect(saveSplatExt.name).toBe('Comfy.SaveGaussianSplat')
    expect(savePointCloudExt.name).toBe('Comfy.SavePointCloud')
  })

  it('save extensions load the saved file from the output folder, not temp', async () => {
    const { saveSplatExt, savePointCloudExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )

    const splatNode = makePreviewNode({ comfyClass: 'SaveGaussianSplat' })
    await saveSplatExt.nodeCreated(splatNode)
    splatNode.onExecuted!({ result: ['3d/ComfyUI_00001_.ply'] })

    expect(configureForSaveMeshMock).toHaveBeenLastCalledWith(
      'output',
      '3d/ComfyUI_00001_.ply',
      expect.objectContaining({ silentOnNotFound: true })
    )

    const pcNode = makePreviewNode({ comfyClass: 'SavePointCloud' })
    await savePointCloudExt.nodeCreated(pcNode)
    pcNode.onExecuted!({ result: ['3d/ComfyUI_00002_.ply'] })

    expect(configureForSaveMeshMock).toHaveBeenLastCalledWith(
      'output',
      '3d/ComfyUI_00002_.ply',
      expect.objectContaining({ silentOnNotFound: true })
    )
  })

  it('restores persisted models from the output folder on nodeCreated, not temp', async () => {
    const { saveSplatExt } = await loadExtensionsFresh()
    const node = makePreviewNode({
      comfyClass: 'SaveGaussianSplat',
      properties: { 'Last Time Model File': '3d/ComfyUI_00001_.ply' }
    })

    await saveSplatExt.nodeCreated(node)

    expect(configureForSaveMeshMock).toHaveBeenCalledWith(
      'output',
      '3d/ComfyUI_00001_.ply',
      expect.objectContaining({ silentOnNotFound: true })
    )
  })
})

describe('Comfy.PreviewGaussianSplat.nodeCreated', () => {
  beforeEach(setupBaseMocks)

  it('skips nodes whose comfyClass is not PreviewGaussianSplat', async () => {
    const { splatExt } = await loadExtensionsFresh()
    const node = makePreviewNode({ comfyClass: 'OtherNode' })

    await splatExt.nodeCreated(node)

    expect(waitForLoad3dMock).not.toHaveBeenCalled()
    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('triggers a model load against the output folder on execute', async () => {
    const { splatExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    const node = makePreviewNode()

    await splatExt.nodeCreated(node)
    node.onExecuted!({ result: ['scene.ply'] })

    expect(node.properties['Last Time Model File']).toBe('scene.ply')
    expect(configureForSaveMeshMock).toHaveBeenLastCalledWith(
      'temp',
      'scene.ply',
      expect.objectContaining({ silentOnNotFound: true })
    )
  })

  it('persists backend-provided camera_info into node.properties so onLoad3dReady can restore it after remount', async () => {
    const { splatExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    const node = makePreviewNode()
    const cameraState = {
      position: { x: 1, y: 2, z: 3 },
      target: { x: 0, y: 0, z: 0 },
      zoom: 1
    }

    await splatExt.nodeCreated(node)
    node.onExecuted!({ result: ['scene.ply', cameraState] })

    const cameraConfig = node.properties['Camera Config'] as
      | { state?: typeof cameraState }
      | undefined
    expect(cameraConfig?.state).toEqual(cameraState)
  })

  it('applies onExecuted results to the remounted instance, not the disposed closure', async () => {
    const { splatExt } = await loadExtensionsFresh()
    const original = makeLoad3dMock()
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(original)
    )
    const node = makePreviewNode()

    await splatExt.nodeCreated(node)

    const remounted = makeLoad3dMock()
    nodeToLoad3dMapMock.set(node, remounted)

    node.onExecuted!({
      result: ['scene.ply', { position: { x: 1, y: 2, z: 3 } }]
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(remounted.forceRender).toHaveBeenCalled()
    expect(original.forceRender).not.toHaveBeenCalled()
  })

  it('re-applies the model transform from result[2] on execute', async () => {
    const { saveSplatExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    const node = makePreviewNode({ comfyClass: 'SaveGaussianSplat' })
    const transform = { position: { x: 1, y: 2, z: 3 } }

    await saveSplatExt.nodeCreated(node)
    node.onExecuted!({ result: ['scene.ply', undefined, [transform]] })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(load3d.applyModelTransform).toHaveBeenCalledWith(transform)
  })

  it('syncs width/height widgets to load3d.setTargetSize and registers callbacks', async () => {
    const { splatExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    const widthWidget: FakeWidget & { callback?: (v: number) => void } = {
      name: 'width',
      value: 800
    }
    const heightWidget: FakeWidget & { callback?: (v: number) => void } = {
      name: 'height',
      value: 600
    }
    const node = makePreviewNode({
      widgets: [
        { name: 'model_file', value: '' },
        { name: 'viewport_state', value: '' },
        widthWidget,
        heightWidget
      ]
    })

    await splatExt.nodeCreated(node)

    expect(load3d.setTargetSize).toHaveBeenCalledWith(800, 600)
    expect(typeof widthWidget.callback).toBe('function')
    expect(typeof heightWidget.callback).toBe('function')

    widthWidget.callback!(1024)
    expect(load3d.setTargetSize).toHaveBeenLastCalledWith(1024, 600)
  })

  it("installs a sceneWidget.serializeValue that returns the viewer's current camera_info + model_3d_info", async () => {
    const { splatExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    const cameraState = { position: { x: 1, y: 2, z: 3 } }
    load3d.getCameraState = vi.fn(() => cameraState)
    load3d.getModelInfo = vi.fn(() => ({
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    }))
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    const sceneWidget: FakeWidget & {
      serializeValue?: () => Promise<unknown>
    } = { name: 'viewport_state', value: '' }
    const node = makePreviewNode({
      widgets: [{ name: 'model_file', value: '' }, sceneWidget]
    })
    nodeToLoad3dMapMock.set(node, load3d)

    await splatExt.nodeCreated(node)

    expect(typeof sceneWidget.serializeValue).toBe('function')
    const payload = (await sceneWidget.serializeValue!()) as {
      camera_info: unknown
      model_3d_info: unknown[]
    }
    expect(payload.camera_info).toEqual(cameraState)
    expect(payload.model_3d_info).toHaveLength(1)
  })

  it('shows an error toast when onExecuted has no file path', async () => {
    const { splatExt } = await loadExtensionsFresh()
    const node = makePreviewNode()

    await splatExt.nodeCreated(node)
    node.onExecuted!({ result: [] })

    expect(toastAddAlertMock).toHaveBeenCalledWith(
      'toastMessages.unableToGetModelFilePath'
    )
  })
})

describe('Comfy.PreviewPointCloud.nodeCreated', () => {
  beforeEach(setupBaseMocks)

  it('skips nodes whose comfyClass is not PreviewPointCloud', async () => {
    const { pointCloudExt } = await loadExtensionsFresh()
    const node = makePreviewNode({ comfyClass: 'OtherNode' })

    await pointCloudExt.nodeCreated(node)

    expect(waitForLoad3dMock).not.toHaveBeenCalled()
    expect(configureForSaveMeshMock).not.toHaveBeenCalled()
  })

  it('triggers a model load against the output folder on execute', async () => {
    const { pointCloudExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    waitForLoad3dMock.mockImplementation((cb: (l: FakeLoad3d) => void) =>
      cb(load3d)
    )
    const node = makePreviewNode({ comfyClass: 'PreviewPointCloud' })

    await pointCloudExt.nodeCreated(node)
    node.onExecuted!({ result: ['pointcloud.ply'] })

    expect(node.properties['Last Time Model File']).toBe('pointcloud.ply')
    expect(configureForSaveMeshMock).toHaveBeenLastCalledWith(
      'temp',
      'pointcloud.ply',
      expect.objectContaining({ silentOnNotFound: true })
    )
  })
})

describe('Comfy.PreviewGaussianSplat.onNodeOutputsUpdated', () => {
  beforeEach(setupBaseMocks)

  it('skips entries whose comfyClass is not PreviewGaussianSplat', async () => {
    const { splatExt } = await loadExtensionsFresh()
    getNodeByLocatorIdMock.mockReturnValue(makePreviewNode({ comfyClass: 'X' }))

    splatExt.onNodeOutputsUpdated({
      'node:1': { result: ['scene.ply'] }
    })

    expect(waitForLoad3dMock).not.toHaveBeenCalled()
  })

  it('skips entries with no result file path', async () => {
    const { splatExt } = await loadExtensionsFresh()
    getNodeByLocatorIdMock.mockReturnValue(makePreviewNode())

    splatExt.onNodeOutputsUpdated({ 'node:1': { result: [] } })

    expect(waitForLoad3dMock).not.toHaveBeenCalled()
  })
})

describe('Comfy.PreviewGaussianSplat.getNodeMenuItems', () => {
  beforeEach(setupBaseMocks)

  it('returns [] for non-PreviewGaussianSplat nodes', async () => {
    const { splatExt } = await loadExtensionsFresh()
    const items = splatExt.getNodeMenuItems(
      makePreviewNode({ comfyClass: 'OtherNode' })
    )
    expect(items).toEqual([])
  })

  it('returns [] for splat models', async () => {
    const { splatExt } = await loadExtensionsFresh()
    const load3d = makeLoad3dMock()
    load3d.isSplatModel = vi.fn(() => true)
    getLoad3dMock.mockReturnValue(load3d)

    const items = splatExt.getNodeMenuItems(makePreviewNode())
    expect(items).toEqual([])
  })
})
