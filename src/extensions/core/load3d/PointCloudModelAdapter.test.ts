import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ModelLoadContext } from './ModelAdapter'
import * as ModelAdapterModule from './ModelAdapter'
import {
  PointCloudModelAdapter,
  buildPointCloudForMaterialMode
} from './PointCloudModelAdapter'

const { mockSettingGet } = vi.hoisted(() => ({
  mockSettingGet: vi.fn<(key: string) => unknown>()
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: mockSettingGet })
}))

vi.mock('@/scripts/metadata/ply', () => ({
  isPLYAsciiFormat: vi.fn().mockReturnValue(false)
}))

vi.mock('three/examples/jsm/loaders/PLYLoader', () => ({
  PLYLoader: class {
    setPath = vi.fn()
    parse = vi.fn(() => makePLYGeometry(false))
  }
}))

vi.mock('./loader/FastPLYLoader', () => ({
  FastPLYLoader: class {
    parse = vi.fn(() => makePLYGeometry(false))
  }
}))

function makePLYGeometry(withColors: boolean): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)
  )
  if (withColors) {
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3)
    )
  }
  return geometry
}

function makeContext(
  materialMode: ModelLoadContext['materialMode'] = 'original'
): ModelLoadContext {
  return {
    setOriginalModel: vi.fn(),
    registerOriginalMaterial: vi.fn(),
    standardMaterial: new THREE.MeshStandardMaterial(),
    materialMode
  }
}

describe('PointCloudModelAdapter', () => {
  beforeEach(() => {
    mockSettingGet.mockReset()
  })

  describe('identity', () => {
    it('handles the ply extension', () => {
      const adapter = new PointCloudModelAdapter()
      expect([...adapter.extensions]).toEqual(['ply'])
    })

    it('identifies as pointCloud with rebuild + gizmo/fit disabled', () => {
      const adapter = new PointCloudModelAdapter()
      expect(adapter.kind).toBe('pointCloud')
      expect(adapter.capabilities.fitToViewer).toBe(false)
      expect(adapter.capabilities.requiresMaterialRebuild).toBe(true)
      expect(adapter.capabilities.gizmoTransform).toBe(false)
      expect(adapter.capabilities.lighting).toBe(true)
      expect(adapter.capabilities.exportable).toBe(true)
      expect([...adapter.capabilities.materialModes]).toEqual([
        'original',
        'pointCloud',
        'normal',
        'wireframe'
      ])
    })
  })

  describe('load', () => {
    beforeEach(() => {
      mockSettingGet.mockReturnValue('three')
      vi.spyOn(ModelAdapterModule, 'fetchModelData').mockResolvedValue(
        new ArrayBuffer(0)
      )
    })

    it('returns a Group containing a Mesh for non-pointCloud modes', async () => {
      const adapter = new PointCloudModelAdapter()
      const ctx = makeContext('original')

      const result = await adapter.load(ctx, '/api/view?', 'cloud.ply')

      expect(result).toBeInstanceOf(THREE.Group)
      const child = result!.children[0]
      expect(child).toBeInstanceOf(THREE.Mesh)
      expect(ctx.setOriginalModel).toHaveBeenCalledTimes(1)
    })

    it('applies MeshNormalMaterial when materialMode is normal at load time', async () => {
      const adapter = new PointCloudModelAdapter()
      const ctx = makeContext('normal')

      const result = await adapter.load(ctx, '/api/view?', 'cloud.ply')

      const mesh = result!.children[0] as THREE.Mesh
      expect(mesh).toBeInstanceOf(THREE.Mesh)
      expect(mesh.material).toBeInstanceOf(THREE.MeshNormalMaterial)
    })

    it('applies wireframe MeshBasicMaterial when materialMode is wireframe at load time', async () => {
      const adapter = new PointCloudModelAdapter()
      const ctx = makeContext('wireframe')

      const result = await adapter.load(ctx, '/api/view?', 'cloud.ply')

      const mesh = result!.children[0] as THREE.Mesh
      expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial)
      expect((mesh.material as THREE.MeshBasicMaterial).wireframe).toBe(true)
    })

    it('returns a Group containing Points when materialMode is pointCloud', async () => {
      const adapter = new PointCloudModelAdapter()
      const ctx = makeContext('pointCloud')

      const result = await adapter.load(ctx, '/api/view?', 'cloud.ply')

      expect(result).toBeInstanceOf(THREE.Group)
      const child = result!.children[0]
      expect(child).toBeInstanceOf(THREE.Points)
    })
  })
})

describe('buildPointCloudForMaterialMode', () => {
  function run(mode: Parameters<typeof buildPointCloudForMaterialMode>[1]) {
    const geometry = makePLYGeometry(false)
    const standardMaterial = new THREE.MeshStandardMaterial()
    const originalMaterials = new WeakMap<
      THREE.Mesh,
      THREE.Material | THREE.Material[]
    >()
    const group = buildPointCloudForMaterialMode(
      geometry,
      mode,
      standardMaterial,
      originalMaterials
    )
    return { group, originalMaterials }
  }

  it('produces a Group with Points when mode is pointCloud', () => {
    const { group } = run('pointCloud')
    expect(group).toBeInstanceOf(THREE.Group)
    expect(group.children[0]).toBeInstanceOf(THREE.Points)
  })

  it('produces a Mesh with MeshStandardMaterial for original mode', () => {
    const { group } = run('original')
    const mesh = group.children[0] as THREE.Mesh
    expect(mesh).toBeInstanceOf(THREE.Mesh)
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial)
  })

  it('overrides the mesh material with MeshNormalMaterial for normal mode', () => {
    const { group } = run('normal')
    const mesh = group.children[0] as THREE.Mesh
    expect(mesh.material).toBeInstanceOf(THREE.MeshNormalMaterial)
  })

  it('overrides the mesh material with wireframe MeshBasicMaterial', () => {
    const { group } = run('wireframe')
    const mesh = group.children[0] as THREE.Mesh
    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial)
    expect((mesh.material as THREE.MeshBasicMaterial).wireframe).toBe(true)
  })

  it('registers the mesh and its material in the originalMaterials WeakMap', () => {
    const { group, originalMaterials } = run('original')
    const mesh = group.children[0] as THREE.Mesh
    expect(originalMaterials.has(mesh)).toBe(true)
    expect(originalMaterials.get(mesh)).toBe(mesh.material)
  })

  it('clones the input geometry instead of mutating it', () => {
    const geometry = makePLYGeometry(false)
    const standardMaterial = new THREE.MeshStandardMaterial()
    const originalMaterials = new WeakMap<
      THREE.Mesh,
      THREE.Material | THREE.Material[]
    >()
    const group = buildPointCloudForMaterialMode(
      geometry,
      'pointCloud',
      standardMaterial,
      originalMaterials
    )
    const points = group.children[0] as THREE.Points
    // pointCloud mode normalises the clone via translate+scale; the input
    // geometry must stay untouched.
    expect(points.geometry).not.toBe(geometry)
  })

  it('uses vertex colors when the geometry has a color attribute', () => {
    const geometry = makePLYGeometry(true)
    const originalMaterials = new WeakMap<
      THREE.Mesh,
      THREE.Material | THREE.Material[]
    >()
    const group = buildPointCloudForMaterialMode(
      geometry,
      'pointCloud',
      new THREE.MeshStandardMaterial(),
      originalMaterials
    )
    const points = group.children[0] as THREE.Points
    expect((points.material as THREE.PointsMaterial).vertexColors).toBe(true)
  })
})
