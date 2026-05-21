import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  addCustomEventListenerMock,
  fetchApiMock,
  getNodeByLocatorIdMock,
  nodeToLoad3dMap,
  configureForSaveMeshMock,
  uploadTempImageMock
} = vi.hoisted(() => ({
  addCustomEventListenerMock: vi.fn(),
  fetchApiMock: vi.fn(),
  getNodeByLocatorIdMock: vi.fn(),
  nodeToLoad3dMap: new Map<unknown, unknown>(),
  configureForSaveMeshMock: vi.fn(),
  uploadTempImageMock: vi.fn()
}))

vi.mock('@/scripts/api', () => ({
  api: {
    addCustomEventListener: addCustomEventListenerMock,
    fetchApi: fetchApiMock
  }
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: {} }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: getNodeByLocatorIdMock
}))

vi.mock('@/composables/useLoad3d', () => ({
  nodeToLoad3dMap
}))

vi.mock('@/extensions/core/load3d/Load3DConfiguration', () => ({
  default: class {
    configureForSaveMesh = configureForSaveMeshMock
  }
}))

vi.mock('@/extensions/core/load3d/Load3dUtils', () => ({
  default: {
    uploadTempImage: uploadTempImageMock
  }
}))

type RenderRequestPayload = {
  render_id: string
  node_id: string
  file_path: string
  type: 'input' | 'output' | 'temp'
  width?: number
  height?: number
  camera_info?: {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    zoom: number
    cameraType: 'perspective' | 'orthographic'
  } | null
}

async function loadRenderBridge() {
  vi.resetModules()
  addCustomEventListenerMock.mockClear()
  await import('@/extensions/core/load3d/renderBridge')
}

function getRegisteredHandler(): (event: CustomEvent<unknown>) => void {
  const call = addCustomEventListenerMock.mock.calls[0]
  expect(call).toBeDefined()
  expect(call[0]).toBe('preview3d.render_request')
  return call[1] as (event: CustomEvent<unknown>) => void
}

function makeLoad3d(
  overrides: Partial<{
    whenLoadIdle: ReturnType<typeof vi.fn>
    captureSceneFixedCamera: ReturnType<typeof vi.fn>
    handleResize: ReturnType<typeof vi.fn>
  }> = {}
) {
  return {
    whenLoadIdle:
      overrides.whenLoadIdle ?? vi.fn().mockResolvedValue(undefined),
    captureSceneFixedCamera:
      overrides.captureSceneFixedCamera ??
      vi.fn().mockResolvedValue({
        scene: 'data:scene',
        mask: 'data:mask',
        normal: 'data:normal'
      }),
    handleResize: overrides.handleResize ?? vi.fn()
  }
}

function makePayload(
  overrides: Partial<RenderRequestPayload> = {}
): RenderRequestPayload {
  return {
    render_id: 'rid-1',
    node_id: 'node-1',
    file_path: '3d/mesh.glb',
    type: 'output',
    width: 512,
    height: 512,
    ...overrides
  }
}

async function dispatchAndFlush(
  handler: (event: CustomEvent<unknown>) => void,
  detail: RenderRequestPayload | null
) {
  handler({ detail } as CustomEvent<unknown>)
  // Let the fire-and-forget handler microtasks settle.
  await new Promise((r) => setTimeout(r, 0))
}

describe('renderBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nodeToLoad3dMap.clear()
    fetchApiMock.mockResolvedValue({ ok: true })
  })

  it('registers a "preview3d.render_request" listener at module load', async () => {
    await loadRenderBridge()
    expect(addCustomEventListenerMock).toHaveBeenCalledOnce()
    expect(addCustomEventListenerMock.mock.calls[0][0]).toBe(
      'preview3d.render_request'
    )
  })

  it('ignores events without a render_id (does not POST a response)', async () => {
    await loadRenderBridge()
    const handler = getRegisteredHandler()

    await dispatchAndFlush(handler, null)
    handler({ detail: { render_id: '' } } as CustomEvent<unknown>)

    expect(fetchApiMock).not.toHaveBeenCalled()
  })

  it('POSTs an error when the node id cannot be resolved', async () => {
    await loadRenderBridge()
    getNodeByLocatorIdMock.mockReturnValue(null)
    const handler = getRegisteredHandler()

    await dispatchAndFlush(handler, makePayload())

    expect(fetchApiMock).toHaveBeenCalledOnce()
    const body = JSON.parse(fetchApiMock.mock.calls[0][1].body as string)
    expect(body.render_id).toBe('rid-1')
    expect(body.error).toContain('node node-1 not found')
  })

  it('POSTs an error when the node has no load3d instance', async () => {
    await loadRenderBridge()
    const node = { id: 1 }
    getNodeByLocatorIdMock.mockReturnValue(node)
    // intentionally don't add to nodeToLoad3dMap
    const handler = getRegisteredHandler()

    await dispatchAndFlush(handler, makePayload())

    const body = JSON.parse(fetchApiMock.mock.calls[0][1].body as string)
    expect(body.error).toContain('load3d instance not available')
  })

  it('captures, uploads, and POSTs image/mask paths on success', async () => {
    await loadRenderBridge()
    const node = { properties: {} }
    const load3d = makeLoad3d()
    getNodeByLocatorIdMock.mockReturnValue(node)
    nodeToLoad3dMap.set(node, load3d)
    uploadTempImageMock
      .mockResolvedValueOnce({ name: 'scene_123.png' })
      .mockResolvedValueOnce({ name: 'mask_123.png' })

    const handler = getRegisteredHandler()
    await dispatchAndFlush(handler, makePayload())

    expect(configureForSaveMeshMock).toHaveBeenCalledWith(
      'output',
      '3d/mesh.glb',
      { silentOnNotFound: true }
    )
    expect(load3d.whenLoadIdle).toHaveBeenCalled()
    expect(load3d.captureSceneFixedCamera).toHaveBeenCalledWith(
      512,
      512,
      undefined
    )
    expect(uploadTempImageMock).toHaveBeenNthCalledWith(
      1,
      'data:scene',
      'preview3d_scene'
    )
    expect(uploadTempImageMock).toHaveBeenNthCalledWith(
      2,
      'data:mask',
      'preview3d_mask'
    )
    expect(load3d.handleResize).toHaveBeenCalled()

    const body = JSON.parse(fetchApiMock.mock.calls[0][1].body as string)
    expect(body).toEqual({
      render_id: 'rid-1',
      image: 'threed/scene_123.png [temp]',
      mask: 'threed/mask_123.png [temp]'
    })
  })

  it('passes upstream camera_info (priority 1) to captureSceneFixedCamera', async () => {
    await loadRenderBridge()
    const node = {
      properties: {
        // Should be ignored because payload.camera_info wins.
        'Camera Config': {
          state: {
            position: { x: 99, y: 99, z: 99 },
            target: { x: 0, y: 0, z: 0 },
            zoom: 1,
            cameraType: 'perspective'
          }
        }
      }
    }
    const load3d = makeLoad3d()
    getNodeByLocatorIdMock.mockReturnValue(node)
    nodeToLoad3dMap.set(node, load3d)
    uploadTempImageMock.mockResolvedValue({ name: 'x.png' })

    const handler = getRegisteredHandler()
    await dispatchAndFlush(
      handler,
      makePayload({
        camera_info: {
          position: { x: 1, y: 2, z: 3 },
          target: { x: 4, y: 5, z: 6 },
          zoom: 2,
          cameraType: 'perspective'
        }
      })
    )

    const [w, h, cameraState] = load3d.captureSceneFixedCamera.mock.calls[0]
    expect(w).toBe(512)
    expect(h).toBe(512)
    expect(cameraState.position.toArray()).toEqual([1, 2, 3])
    expect(cameraState.target.toArray()).toEqual([4, 5, 6])
    expect(cameraState.zoom).toBe(2)
  })

  it('falls back to node.properties Camera Config (priority 2) when no upstream camera_info', async () => {
    await loadRenderBridge()
    const node = {
      properties: {
        'Camera Config': {
          state: {
            position: { x: 7, y: 8, z: 9 },
            target: { x: 1, y: 1, z: 1 },
            zoom: 3,
            cameraType: 'perspective'
          }
        }
      }
    }
    const load3d = makeLoad3d()
    getNodeByLocatorIdMock.mockReturnValue(node)
    nodeToLoad3dMap.set(node, load3d)
    uploadTempImageMock.mockResolvedValue({ name: 'x.png' })

    const handler = getRegisteredHandler()
    await dispatchAndFlush(handler, makePayload())

    const cameraState = load3d.captureSceneFixedCamera.mock.calls[0][2]
    expect(cameraState).toBeDefined()
    expect(cameraState.position.toArray()).toEqual([7, 8, 9])
    expect(cameraState.zoom).toBe(3)
  })

  it('passes undefined (priority 3) when neither input nor saved Camera Config exists', async () => {
    await loadRenderBridge()
    const node = { properties: {} }
    const load3d = makeLoad3d()
    getNodeByLocatorIdMock.mockReturnValue(node)
    nodeToLoad3dMap.set(node, load3d)
    uploadTempImageMock.mockResolvedValue({ name: 'x.png' })

    const handler = getRegisteredHandler()
    await dispatchAndFlush(handler, makePayload())

    const cameraState = load3d.captureSceneFixedCamera.mock.calls[0][2]
    expect(cameraState).toBeUndefined()
  })

  it('POSTs an error response when captureSceneFixedCamera throws', async () => {
    await loadRenderBridge()
    const node = { properties: {} }
    const load3d = makeLoad3d({
      captureSceneFixedCamera: vi.fn().mockRejectedValue(new Error('boom'))
    })
    getNodeByLocatorIdMock.mockReturnValue(node)
    nodeToLoad3dMap.set(node, load3d)

    const handler = getRegisteredHandler()
    await dispatchAndFlush(handler, makePayload())

    const body = JSON.parse(fetchApiMock.mock.calls[0][1].body as string)
    expect(body.render_id).toBe('rid-1')
    expect(body.error).toBe('boom')
  })

  it('falls back to the frontend default resolution when payload omits width/height', async () => {
    await loadRenderBridge()
    const node = { properties: {} }
    const load3d = makeLoad3d()
    getNodeByLocatorIdMock.mockReturnValue(node)
    nodeToLoad3dMap.set(node, load3d)
    uploadTempImageMock.mockResolvedValue({ name: 'x.png' })

    const handler = getRegisteredHandler()
    const payload = makePayload()
    // Backend now omits width/height — frontend should default to 512.
    delete payload.width
    delete payload.height
    await dispatchAndFlush(handler, payload)

    expect(load3d.captureSceneFixedCamera).toHaveBeenCalledWith(
      512,
      512,
      undefined
    )
  })

  it('honors payload.type=input when constructing the load folder', async () => {
    await loadRenderBridge()
    const node = { properties: {} }
    const load3d = makeLoad3d()
    getNodeByLocatorIdMock.mockReturnValue(node)
    nodeToLoad3dMap.set(node, load3d)
    uploadTempImageMock.mockResolvedValue({ name: 'x.png' })

    const handler = getRegisteredHandler()
    await dispatchAndFlush(handler, makePayload({ type: 'input' }))

    expect(configureForSaveMeshMock).toHaveBeenCalledWith(
      'input',
      '3d/mesh.glb',
      { silentOnNotFound: true }
    )
  })
})
