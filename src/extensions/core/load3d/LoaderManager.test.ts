import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  EventManagerInterface,
  MaterialMode,
  ModelManagerInterface
} from './interfaces'
import { LoaderManager } from './LoaderManager'
import type { ModelAdapter, ModelLoadContext } from './ModelAdapter'

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

const { meshLoad, splatLoad, pointCloudLoad, getPLYEngineMock, addAlert } =
  vi.hoisted(() => ({
    meshLoad: vi.fn(),
    splatLoad: vi.fn(),
    pointCloudLoad: vi.fn(),
    getPLYEngineMock: vi.fn<() => string>(),
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
  },
  getPLYEngine: () => getPLYEngineMock()
}))

vi.mock('./SplatModelAdapter', () => ({
  SplatModelAdapter: class {
    readonly kind = 'splat' as const
    readonly extensions = ['spz', 'splat', 'ksplat'] as const
    readonly capabilities = {}
    load = splatLoad
  }
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert })
}))

type LoaderManagerInternals = {
  pickAdapter(extension: string): ModelAdapter | null
}

function makeLoaderManager() {
  const modelManager = makeModelManagerStub()
  const eventManager = makeEventManagerStub()
  const lm = new LoaderManager(
    modelManager as unknown as ConstructorParameters<typeof LoaderManager>[0],
    eventManager
  )
  const internals = lm as unknown as LoaderManagerInternals
  return {
    lm,
    modelManager,
    eventManager,
    pick: internals.pickAdapter.bind(lm)
  }
}

describe('LoaderManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPLYEngineMock.mockReturnValue('three')
    meshLoad.mockResolvedValue(null)
    splatLoad.mockResolvedValue(null)
    pointCloudLoad.mockResolvedValue(null)
  })

  describe('getCurrentAdapter', () => {
    it('returns null before any model loads', () => {
      const { lm } = makeLoaderManager()
      expect(lm.getCurrentAdapter()).toBeNull()
    })

    it('exposes the picked adapter after a successful load', async () => {
      const { lm } = makeLoaderManager()
      meshLoad.mockResolvedValueOnce(new THREE.Object3D())

      await lm.loadModel('api/view?filename=cube.glb')

      expect(lm.getCurrentAdapter()?.kind).toBe('mesh')
    })

    it('resets to null at the start of a new load', async () => {
      const { lm } = makeLoaderManager()
      meshLoad.mockResolvedValueOnce(new THREE.Object3D())

      await lm.loadModel('api/view?filename=cube.glb')
      expect(lm.getCurrentAdapter()?.kind).toBe('mesh')

      await lm.loadModel('api/view?filename=cube.xyz')
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
      const lm = new LoaderManager(modelManager, eventManager, [oldAdapter])
      // Prime the loader with an active adapter, then trigger a new load.
      ;(lm as unknown as { _currentAdapter: ModelAdapter })._currentAdapter =
        oldAdapter
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
  })

  describe('pickAdapter', () => {
    it.each(['stl', 'fbx', 'obj', 'gltf', 'glb'])(
      'routes %s to the mesh adapter',
      (ext) => {
        const { pick } = makeLoaderManager()
        expect(pick(ext)?.kind).toBe('mesh')
      }
    )

    it.each(['spz', 'splat', 'ksplat'])(
      'routes %s to the splat adapter',
      (ext) => {
        const { pick } = makeLoaderManager()
        expect(pick(ext)?.kind).toBe('splat')
      }
    )

    it('routes .ply to the point-cloud adapter for the default three engine', () => {
      getPLYEngineMock.mockReturnValue('three')
      const { pick } = makeLoaderManager()
      expect(pick('ply')?.kind).toBe('pointCloud')
    })

    it('routes .ply to the point-cloud adapter for the fastply engine', () => {
      getPLYEngineMock.mockReturnValue('fastply')
      const { pick } = makeLoaderManager()
      expect(pick('ply')?.kind).toBe('pointCloud')
    })

    it('routes .ply to the splat adapter when the engine setting is sparkjs', () => {
      getPLYEngineMock.mockReturnValue('sparkjs')
      const { pick } = makeLoaderManager()
      expect(pick('ply')?.kind).toBe('splat')
    })

    it('returns null for unknown extensions', () => {
      const { pick } = makeLoaderManager()
      expect(pick('xyz')).toBeNull()
      expect(pick('')).toBeNull()
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
      meshLoad.mockResolvedValueOnce(loaded)

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
      meshLoad.mockResolvedValueOnce(new THREE.Object3D())

      await lm.loadModel('api/view?filename=cube.glb')

      expect(eventManager.emitEvent).toHaveBeenCalledWith(
        'modelLoadingEnd',
        null
      )
    })

    it('forwards a decoded path and filename to the adapter', async () => {
      const { lm } = makeLoaderManager()
      meshLoad.mockResolvedValueOnce(new THREE.Object3D())

      await lm.loadModel(
        'api/view?type=output&subfolder=nested%2Fdir&filename=cube.glb'
      )

      expect(meshLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          setOriginalModel: expect.any(Function),
          registerOriginalMaterial: expect.any(Function)
        }),
        'api/view?type=output&subfolder=nested%2Fdir&filename=',
        'cube.glb'
      )
    })

    it('defaults the path to type=input when no type param is given', async () => {
      const { lm } = makeLoaderManager()
      meshLoad.mockResolvedValueOnce(new THREE.Object3D())

      await lm.loadModel('api/view?filename=cube.glb')

      expect(meshLoad).toHaveBeenCalledWith(
        expect.anything(),
        'api/view?type=input&subfolder=&filename=',
        'cube.glb'
      )
    })

    it('routes .ply through the splat adapter when the engine setting is sparkjs', async () => {
      getPLYEngineMock.mockReturnValue('sparkjs')
      const { lm } = makeLoaderManager()
      splatLoad.mockResolvedValueOnce(new THREE.Object3D())

      await lm.loadModel('api/view?filename=scan.ply')

      expect(splatLoad).toHaveBeenCalled()
      expect(pointCloudLoad).not.toHaveBeenCalled()
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
        .mockImplementationOnce(() => firstLoad)
        .mockResolvedValueOnce(secondModel)

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
