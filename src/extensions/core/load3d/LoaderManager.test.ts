import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  EventManagerInterface,
  MaterialMode,
  ModelManagerInterface
} from './interfaces'
import { LoaderManager } from './LoaderManager'
import type {
  ModelAdapter,
  ModelAdapterCapabilities,
  ModelLoadContext
} from './ModelAdapter'

function makeEventManagerStub() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    emitEvent: vi.fn()
  }
}

type ModelManagerStub = {
  clearModel: ReturnType<typeof vi.fn>
  setupModel: ReturnType<typeof vi.fn>
  setOriginalModel: ReturnType<typeof vi.fn>
  originalMaterials: WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>
  standardMaterial: THREE.MeshStandardMaterial
  materialMode: MaterialMode
  originalFileName: string | null
  originalURL: string | null
}

const STUB_CAPS = {} as ModelAdapterCapabilities
const loadResult = (object: THREE.Object3D) => ({
  object,
  capabilities: STUB_CAPS
})

function makeModelManagerStub(): ModelManagerStub {
  return {
    clearModel: vi.fn(),
    setupModel: vi.fn().mockResolvedValue(undefined),
    setOriginalModel: vi.fn(),
    originalMaterials: new WeakMap(),
    standardMaterial: new THREE.MeshStandardMaterial(),
    materialMode: 'original',
    originalFileName: 'model',
    originalURL: null
  }
}

const {
  meshLoad,
  splatLoad,
  pointCloudLoad,
  fetchModelDataMock,
  isGaussianSplatPLYMock,
  addAlert
} = vi.hoisted(() => ({
  meshLoad: vi.fn(),
  splatLoad: vi.fn(),
  pointCloudLoad: vi.fn(),
  fetchModelDataMock: vi.fn<() => Promise<ArrayBuffer>>(),
  isGaussianSplatPLYMock: vi.fn<(b: ArrayBuffer) => Promise<boolean>>(),
  addAlert: vi.fn()
}))

vi.mock('./MeshModelAdapter', () => ({
  MeshModelAdapter: class {
    readonly kind = 'mesh' as const
    readonly extensions = ['stl', 'fbx', 'obj', 'gltf', 'glb'] as const
    readonly capabilities = {}
    load = meshLoad
  }
}))

vi.mock('./PointCloudModelAdapter', () => ({
  PointCloudModelAdapter: class {
    readonly kind = 'pointCloud' as const
    readonly extensions = ['ply'] as const
    readonly capabilities = {}
    load = pointCloudLoad
  }
}))

vi.mock('./SplatModelAdapter', () => ({
  SplatModelAdapter: class {
    readonly kind = 'splat' as const
    readonly extensions = ['spz', 'splat', 'ksplat', 'ply'] as const
    readonly capabilities = {}
    matches = async (
      ext: string,
      fetchBytes: () => Promise<ArrayBuffer>
    ): Promise<boolean> => {
      if (ext !== 'ply') return true
      return isGaussianSplatPLYMock(await fetchBytes())
    }
    load = splatLoad
  }
}))

vi.mock('./ModelAdapter', async () => {
  const actual =
    await vi.importActual<typeof import('./ModelAdapter')>('./ModelAdapter')
  return { ...actual, fetchModelData: fetchModelDataMock }
})

vi.mock('@/scripts/metadata/ply', () => ({
  isGaussianSplatPLY: isGaussianSplatPLYMock
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert })
}))

type LoaderManagerInternals = {
  pickAdapter(
    extension: string,
    fetchBytes: () => Promise<ArrayBuffer>
  ): Promise<ModelAdapter | null>
}

function makeLoaderManager() {
  const modelManager = makeModelManagerStub()
  const eventManager = makeEventManagerStub()
  const lm = new LoaderManager(
    modelManager as unknown as ConstructorParameters<typeof LoaderManager>[0],
    eventManager
  )
  const internals = lm as unknown as LoaderManagerInternals
  const pick = (ext: string) =>
    internals.pickAdapter.call(lm, ext, () =>
      fetchModelDataMock()
    ) as Promise<ModelAdapter | null>
  return { lm, modelManager, eventManager, pick }
}

describe('LoaderManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    meshLoad.mockResolvedValue(null)
    splatLoad.mockResolvedValue(null)
    pointCloudLoad.mockResolvedValue(null)
    fetchModelDataMock.mockResolvedValue(new ArrayBuffer(0))
    isGaussianSplatPLYMock.mockResolvedValue(false)
  })

  describe('getCurrentAdapter', () => {
    it('returns null before any model loads', () => {
      const { lm } = makeLoaderManager()
      expect(lm.getCurrentAdapter()).toBeNull()
    })

    it('exposes the picked adapter after a successful load', async () => {
      const { lm } = makeLoaderManager()
      meshLoad.mockResolvedValueOnce(loadResult(new THREE.Object3D()))

      await lm.loadModel('api/view?filename=cube.glb')

      expect(lm.getCurrentAdapter()?.kind).toBe('mesh')
    })

    it('resets to null at the start of a new load', async () => {
      const { lm } = makeLoaderManager()
      meshLoad.mockResolvedValueOnce(loadResult(new THREE.Object3D()))

      await lm.loadModel('api/view?filename=cube.glb')
      expect(lm.getCurrentAdapter()?.kind).toBe('mesh')

      await lm.loadModel('api/view?filename=cube.xyz')
      expect(lm.getCurrentAdapter()).toBeNull()
    })

    it('stays null when the adapter rejects (does not publish stale adapter)', async () => {
      const { lm } = makeLoaderManager()

      meshLoad.mockResolvedValueOnce(loadResult(new THREE.Object3D()))
      await lm.loadModel('api/view?filename=cube.glb')
      expect(lm.getCurrentAdapter()?.kind).toBe('mesh')

      splatLoad.mockRejectedValueOnce(new Error('boom'))
      vi.spyOn(console, 'error').mockImplementation(() => {})

      await lm.loadModel('api/view?filename=scan.splat')

      expect(lm.getCurrentAdapter()).toBeNull()
    })

    it('stays null when the adapter resolves null (parse failure)', async () => {
      const { lm } = makeLoaderManager()
      pointCloudLoad.mockResolvedValueOnce(null)

      await lm.loadModel('api/view?filename=scan.ply')

      expect(lm.getCurrentAdapter()).toBeNull()
    })
  })

  describe('loadModel ordering', () => {
    it('keeps the old adapter current while clearModel runs (so future dispose hooks see it)', async () => {
      const oldAdapter = {
        kind: 'splat' as const,
        extensions: ['splat'] as const,
        capabilities: {
          fitToViewer: false,
          requiresMaterialRebuild: false,
          gizmoTransform: false,
          lighting: false,
          exportable: false,
          materialModes: [],
          fitTargetSize: 5
        },
        load: vi.fn().mockResolvedValue(null)
      } satisfies ModelAdapter

      const modelManager = {
        originalMaterials: new WeakMap(),
        clearModel: vi.fn(),
        setupModel: vi.fn()
      } as unknown as ModelManagerInterface
      const eventManager: EventManagerInterface = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        emitEvent: vi.fn()
      }

      let adapterDuringClear: ModelAdapter | null | undefined
      const adapterRef = {
        current: oldAdapter as ModelAdapter | null,
        capabilities: oldAdapter.capabilities as ModelAdapterCapabilities | null
      }
      const lm = new LoaderManager(
        modelManager,
        eventManager,
        [oldAdapter],
        adapterRef
      )
      ;(modelManager.clearModel as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          adapterDuringClear = lm.getCurrentAdapter()
        }
      )

      await lm.loadModel(
        'api/view?type=input&subfolder=&filename=a.splat',
        'a.splat'
      )

      expect(adapterDuringClear).toBe(oldAdapter)
    })

    it('does not let a slow stale load clobber adapterRef after a newer load took over', async () => {
      const { lm } = makeLoaderManager()

      let resolveSplatLoad!: (model: THREE.Object3D) => void
      const slowSplatLoad = new Promise<THREE.Object3D>((resolve) => {
        resolveSplatLoad = resolve
      })
      splatLoad.mockReturnValueOnce(slowSplatLoad.then(loadResult))
      meshLoad.mockResolvedValueOnce(loadResult(new THREE.Object3D()))

      const aPromise = lm.loadModel('api/view?filename=a.splat')

      await Promise.resolve()

      await lm.loadModel('api/view?filename=b.glb')
      expect(lm.getCurrentAdapter()?.kind).toBe('mesh')

      resolveSplatLoad(new THREE.Object3D())
      await aPromise

      expect(lm.getCurrentAdapter()?.kind).toBe('mesh')
    })
  })

  describe('pickAdapter', () => {
    it.for(['stl', 'fbx', 'obj', 'gltf', 'glb'])(
      'routes %s to the mesh adapter',
      async (ext) => {
        const { pick } = makeLoaderManager()
        expect((await pick(ext))?.kind).toBe('mesh')
      }
    )

    it.for(['spz', 'splat', 'ksplat'])(
      'routes %s to the splat adapter',
      async (ext) => {
        const { pick } = makeLoaderManager()
        expect((await pick(ext))?.kind).toBe('splat')
      }
    )

    it('routes .ply to the splat adapter when the bytes look like 3DGS', async () => {
      isGaussianSplatPLYMock.mockResolvedValue(true)
      const { pick } = makeLoaderManager()
      expect((await pick('ply'))?.kind).toBe('splat')
    })

    it('falls back to the point-cloud adapter for .ply that is not 3DGS', async () => {
      isGaussianSplatPLYMock.mockResolvedValue(false)
      const { pick } = makeLoaderManager()
      expect((await pick('ply'))?.kind).toBe('pointCloud')
    })

    it('returns null for unknown extensions', async () => {
      const { pick } = makeLoaderManager()
      expect(await pick('xyz')).toBeNull()
      expect(await pick('')).toBeNull()
    })
  })

  describe('loadModel', () => {
    it('emits modelLoadingStart and records originalURL before dispatching', async () => {
      const { lm, eventManager, modelManager } = makeLoaderManager()

      await lm.loadModel('api/view?filename=cube.glb')

      expect(eventManager.emitEvent).toHaveBeenCalledWith(
        'modelLoadingStart',
        null
      )
      expect(modelManager.originalURL).toBe('api/view?filename=cube.glb')
    })

    it('clears any existing model before routing to the adapter', async () => {
      const { lm, modelManager } = makeLoaderManager()
      const order: string[] = []
      modelManager.clearModel.mockImplementation(() => order.push('clear'))
      meshLoad.mockImplementationOnce(async () => {
        order.push('load')
        return null
      })

      await lm.loadModel('api/view?filename=cube.glb')

      expect(order).toEqual(['clear', 'load'])
    })

    it('derives originalFileName from an explicit originalFileName argument', async () => {
      const { lm, modelManager } = makeLoaderManager()

      await lm.loadModel('api/view?filename=ignored.glb', 'uploads/my-cube.glb')

      expect(modelManager.originalFileName).toBe('my-cube')
    })

    it('derives originalFileName from the URL filename param when no override is given', async () => {
      const { lm, modelManager } = makeLoaderManager()

      await lm.loadModel('api/view?filename=cube.glb')

      expect(modelManager.originalFileName).toBe('cube')
    })

    it('falls back to "model" when the URL has no filename param', async () => {
      const { lm, modelManager } = makeLoaderManager()

      await lm.loadModel('api/view?other=1')

      expect(modelManager.originalFileName).toBe('model')
    })

    it('alerts when the file extension cannot be determined', async () => {
      const { lm, modelManager } = makeLoaderManager()

      await lm.loadModel('api/view?other=1')

      expect(addAlert).toHaveBeenCalledWith(
        'toastMessages.couldNotDetermineFileType'
      )
      expect(modelManager.setupModel).not.toHaveBeenCalled()
      expect(meshLoad).not.toHaveBeenCalled()
    })

    it('passes setupModel the object returned by the adapter', async () => {
      const { lm, modelManager } = makeLoaderManager()
      const loaded = new THREE.Object3D()
      meshLoad.mockResolvedValueOnce(loadResult(loaded))

      await lm.loadModel('api/view?filename=cube.glb')

      expect(modelManager.setupModel).toHaveBeenCalledWith(loaded)
    })

    it('skips setupModel when the adapter returns null', async () => {
      const { lm, modelManager } = makeLoaderManager()
      meshLoad.mockResolvedValueOnce(null)

      await lm.loadModel('api/view?filename=cube.glb')

      expect(modelManager.setupModel).not.toHaveBeenCalled()
    })

    it('emits modelLoadingEnd when the load completes', async () => {
      const { lm, eventManager } = makeLoaderManager()
      meshLoad.mockResolvedValueOnce(loadResult(new THREE.Object3D()))

      await lm.loadModel('api/view?filename=cube.glb')

      expect(eventManager.emitEvent).toHaveBeenCalledWith(
        'modelLoadingEnd',
        null
      )
    })

    it('forwards a decoded path and filename to the adapter', async () => {
      const { lm } = makeLoaderManager()
      meshLoad.mockResolvedValueOnce(loadResult(new THREE.Object3D()))

      await lm.loadModel(
        'api/view?type=output&subfolder=nested%2Fdir&filename=cube.glb'
      )

      expect(meshLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          setOriginalModel: expect.any(Function),
          registerOriginalMaterial: expect.any(Function)
        }),
        'api/view?type=output&subfolder=nested%2Fdir&filename=',
        'cube.glb',
        expect.any(Function)
      )
    })

    it('defaults the path to type=input when no type param is given', async () => {
      const { lm } = makeLoaderManager()
      meshLoad.mockResolvedValueOnce(loadResult(new THREE.Object3D()))

      await lm.loadModel('api/view?filename=cube.glb')

      expect(meshLoad).toHaveBeenCalledWith(
        expect.anything(),
        'api/view?type=input&subfolder=&filename=',
        'cube.glb',
        expect.any(Function)
      )
    })

    it('routes .ply to the point-cloud adapter when the header does not look like 3DGS', async () => {
      isGaussianSplatPLYMock.mockResolvedValue(false)
      const { lm } = makeLoaderManager()
      pointCloudLoad.mockResolvedValueOnce(loadResult(new THREE.Object3D()))

      await lm.loadModel('api/view?filename=scan.ply')

      expect(pointCloudLoad).toHaveBeenCalled()
      expect(splatLoad).not.toHaveBeenCalled()
      expect(lm.getCurrentAdapter()?.kind).toBe('pointCloud')
    })

    it('reroutes .ply through the splat adapter when the header looks like 3DGS', async () => {
      isGaussianSplatPLYMock.mockResolvedValue(true)
      const { lm } = makeLoaderManager()
      splatLoad.mockResolvedValueOnce(loadResult(new THREE.Object3D()))

      await lm.loadModel('api/view?filename=scan.ply')

      expect(splatLoad).toHaveBeenCalled()
      expect(pointCloudLoad).not.toHaveBeenCalled()
      expect(lm.getCurrentAdapter()?.kind).toBe('splat')
    })

    it('shares a single fetch between matches() and load() so .ply is not re-downloaded', async () => {
      const buf = new ArrayBuffer(16)
      fetchModelDataMock.mockResolvedValueOnce(buf)
      isGaussianSplatPLYMock.mockResolvedValue(true)
      const { lm } = makeLoaderManager()
      splatLoad.mockResolvedValueOnce(loadResult(new THREE.Object3D()))

      await lm.loadModel('api/view?filename=scan.ply')

      // Adapter receives a fetchBytes function (memoized), not bytes directly.
      expect(splatLoad).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        'scan.ply',
        expect.any(Function)
      )
      // matches() called fetchBytes once; load()'s call hit the cached promise.
      expect(fetchModelDataMock).toHaveBeenCalledTimes(1)
    })

    it('dispatches .ply via the adapter matches() tiebreaker, not extension order — a splat adapter whose matches() returns false yields to point-cloud', async () => {
      const modelManager =
        makeModelManagerStub() as unknown as ConstructorParameters<
          typeof LoaderManager
        >[0]
      const eventManager = makeEventManagerStub()
      // A splat adapter that ALSO claims '.ply' and is listed first.
      // Without matches(), it would short-circuit. With matches() returning
      // false (not a 3DGS PLY), the dispatcher must skip to the next
      // candidate (point cloud).
      const splatAdapter = {
        kind: 'splat' as const,
        extensions: ['ply', 'spz', 'splat', 'ksplat'] as const,
        capabilities: {} as never,
        matches: async (ext: string, fetchBytes: () => Promise<ArrayBuffer>) =>
          ext === 'ply' ? isGaussianSplatPLYMock(await fetchBytes()) : true,
        load: splatLoad
      }
      const pointCloudAdapter = {
        kind: 'pointCloud' as const,
        extensions: ['ply'] as const,
        capabilities: {} as never,
        load: pointCloudLoad
      }
      const lm = new LoaderManager(modelManager, eventManager, [
        splatAdapter,
        pointCloudAdapter
      ])
      isGaussianSplatPLYMock.mockResolvedValue(false)
      pointCloudLoad.mockResolvedValueOnce(loadResult(new THREE.Object3D()))

      await lm.loadModel('api/view?filename=scan.ply')

      expect(pointCloudLoad).toHaveBeenCalled()
      expect(splatLoad).not.toHaveBeenCalled()
      expect(lm.getCurrentAdapter()?.kind).toBe('pointCloud')
    })

    it('handles adapter errors by alerting and still emitting modelLoadingEnd', async () => {
      const { lm, eventManager } = makeLoaderManager()
      const err = new Error('boom')
      meshLoad.mockRejectedValueOnce(err)
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      await lm.loadModel('api/view?filename=cube.glb')

      expect(eventManager.emitEvent).toHaveBeenCalledWith(
        'modelLoadingEnd',
        null
      )
      expect(addAlert).toHaveBeenCalledWith('toastMessages.errorLoadingModel')
      expect(consoleError).toHaveBeenCalled()
    })

    it('suppresses the alert on a 404 when silentOnNotFound is set', async () => {
      const { lm } = makeLoaderManager()
      const notFound = new Error(
        'fetch for "..." responded with 404: Not Found'
      )
      meshLoad.mockRejectedValueOnce(notFound)
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      await lm.loadModel('api/view?filename=cube.glb', undefined, {
        silentOnNotFound: true
      })

      expect(consoleError).toHaveBeenCalled()
      expect(addAlert).not.toHaveBeenCalledWith(
        'toastMessages.errorLoadingModel'
      )
    })

    it('detects a 404 from the response status field on three.js HttpError', async () => {
      const { lm } = makeLoaderManager()
      const httpError = Object.assign(new Error('not found'), {
        response: { status: 404 }
      })
      meshLoad.mockRejectedValueOnce(httpError)
      vi.spyOn(console, 'error').mockImplementation(() => {})

      await lm.loadModel('api/view?filename=cube.glb', undefined, {
        silentOnNotFound: true
      })

      expect(addAlert).not.toHaveBeenCalledWith(
        'toastMessages.errorLoadingModel'
      )
    })

    it('still alerts on non-404 errors when silentOnNotFound is set', async () => {
      const { lm } = makeLoaderManager()
      meshLoad.mockRejectedValueOnce(new Error('parse failure: bad header'))
      vi.spyOn(console, 'error').mockImplementation(() => {})

      await lm.loadModel('api/view?filename=cube.glb', undefined, {
        silentOnNotFound: true
      })

      expect(addAlert).toHaveBeenCalledWith('toastMessages.errorLoadingModel')
    })

    it('discards the result of a stale load when a newer one has started', async () => {
      const { lm, modelManager, eventManager } = makeLoaderManager()

      let resolveFirst!: (value: THREE.Object3D) => void
      const firstLoad = new Promise<THREE.Object3D>((r) => {
        resolveFirst = r
      })
      const firstModel = new THREE.Object3D()
      firstModel.name = 'first'
      const secondModel = new THREE.Object3D()
      secondModel.name = 'second'

      meshLoad
        .mockImplementationOnce(() => firstLoad.then(loadResult))
        .mockResolvedValueOnce(loadResult(secondModel))

      const firstPromise = lm.loadModel('api/view?filename=first.glb')
      const secondPromise = lm.loadModel('api/view?filename=second.glb')

      resolveFirst(firstModel)

      await Promise.all([firstPromise, secondPromise])

      expect(modelManager.setupModel).toHaveBeenCalledTimes(1)
      expect(modelManager.setupModel).toHaveBeenCalledWith(secondModel)

      const endEmits = eventManager.emitEvent.mock.calls.filter(
        (call: unknown[]) => call[0] === 'modelLoadingEnd'
      )
      expect(endEmits).toHaveLength(1)
    })

    it('logs and drops the load when the URL is missing a filename param', async () => {
      const { lm, modelManager } = makeLoaderManager()
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      await lm.loadModel('api/view?type=output', 'uploads/file.glb')

      expect(consoleError).toHaveBeenCalledWith(
        'Missing filename in URL:',
        'api/view?type=output'
      )
      expect(modelManager.setupModel).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('proxies setOriginalModel and registerOriginalMaterial through the load context', async () => {
      const { lm, modelManager } = makeLoaderManager()
      let capturedCtx: ModelLoadContext | undefined
      meshLoad.mockImplementationOnce(async (ctx: ModelLoadContext) => {
        capturedCtx = ctx
        return new THREE.Object3D()
      })

      await lm.loadModel('api/view?filename=cube.glb')

      const mesh = new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial()
      )
      const mat = new THREE.MeshStandardMaterial()
      capturedCtx!.setOriginalModel(mesh)
      capturedCtx!.registerOriginalMaterial(mesh, mat)

      expect(modelManager.setOriginalModel).toHaveBeenCalledWith(mesh)
      expect(modelManager.originalMaterials.get(mesh)).toBe(mat)
    })

    it('exposes modelManager.standardMaterial and materialMode via getters on the load context', async () => {
      const { lm, modelManager } = makeLoaderManager()
      modelManager.materialMode = 'wireframe'
      let capturedCtx: ModelLoadContext | undefined
      meshLoad.mockImplementationOnce(async (ctx: ModelLoadContext) => {
        capturedCtx = ctx
        return new THREE.Object3D()
      })

      await lm.loadModel('api/view?filename=cube.glb')

      expect(capturedCtx!.standardMaterial).toBe(modelManager.standardMaterial)
      expect(capturedCtx!.materialMode).toBe('wireframe')
    })

    it('suppresses alerts and modelLoadingEnd when a stale load throws', async () => {
      const { lm, eventManager } = makeLoaderManager()

      let rejectFirst!: (err: unknown) => void
      const firstLoad = new Promise<THREE.Object3D>((_, r) => {
        rejectFirst = r
      })

      meshLoad
        .mockImplementationOnce(() => firstLoad)
        .mockResolvedValueOnce(new THREE.Object3D())

      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const firstPromise = lm.loadModel('api/view?filename=first.glb')
      const secondPromise = lm.loadModel('api/view?filename=second.glb')

      rejectFirst(new Error('stale failure'))

      await Promise.all([firstPromise, secondPromise])

      expect(addAlert).not.toHaveBeenCalled()
      const endEmits = eventManager.emitEvent.mock.calls.filter(
        (call: unknown[]) => call[0] === 'modelLoadingEnd'
      )
      expect(endEmits).toHaveLength(1)
      consoleError.mockRestore()
    })
  })
})
