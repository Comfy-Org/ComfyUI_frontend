import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LoaderManager } from './LoaderManager'
import type { ModelAdapter } from './ModelAdapter'
import type { EventManagerInterface, ModelManagerInterface } from './interfaces'

// Each adapter is stubbed with only the fields pickAdapter consults: `kind`
// for identity assertions and `extensions` for routing. `load` is a vi.fn()
// so we can assert on call forwarding if we extend the suite later.
vi.mock('./MeshModelAdapter', () => ({
  MeshModelAdapter: class {
    readonly kind = 'mesh' as const
    readonly extensions = ['stl', 'fbx', 'obj', 'gltf', 'glb'] as const
    readonly capabilities = {}
    load = vi.fn()
  }
}))

const pointCloudInstance = {
  kind: 'pointCloud' as const,
  extensions: ['ply'] as const,
  capabilities: {},
  load: vi.fn()
}
const getPLYEngineMock = vi.fn<() => string>()
vi.mock('./PointCloudModelAdapter', () => ({
  PointCloudModelAdapter: class {
    kind = pointCloudInstance.kind
    extensions = pointCloudInstance.extensions
    capabilities = pointCloudInstance.capabilities
    load = pointCloudInstance.load
  },
  getPLYEngine: () => getPLYEngineMock()
}))

vi.mock('./SplatModelAdapter', () => ({
  SplatModelAdapter: class {
    readonly kind = 'splat' as const
    readonly extensions = ['spz', 'splat', 'ksplat'] as const
    readonly capabilities = {}
    load = vi.fn()
  }
}))

type LoaderManagerInternals = {
  pickAdapter(extension: string): ModelAdapter | null
}

function makeLoaderManager(): {
  lm: LoaderManager
  pick: (ext: string) => ModelAdapter | null
} {
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

  const lm = new LoaderManager(modelManager, eventManager)
  const internals = lm as unknown as LoaderManagerInternals
  return { lm, pick: internals.pickAdapter.bind(lm) }
}

describe('LoaderManager', () => {
  beforeEach(() => {
    getPLYEngineMock.mockReset()
    getPLYEngineMock.mockReturnValue('three')
  })

  describe('getCurrentAdapter', () => {
    it('returns null before any model loads', () => {
      const { lm } = makeLoaderManager()
      expect(lm.getCurrentAdapter()).toBeNull()
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
})
