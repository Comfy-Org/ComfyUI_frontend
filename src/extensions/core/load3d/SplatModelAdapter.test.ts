import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as ModelAdapterModule from './ModelAdapter'
import type { ModelLoadContext } from './ModelAdapter'
import { SplatModelAdapter } from './SplatModelAdapter'

const splatMeshSpies = {
  ctor: vi.fn<(opts: { fileBytes: ArrayBuffer }) => void>(),
  dispose: vi.fn(),
  getBoundingBox: vi.fn(
    () =>
      new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1))
  ),
  updateWorldMatrix: vi.fn()
}

vi.mock('@sparkjsdev/spark', async () => {
  const three = await import('three')
  return {
    SplatMesh: class extends three.Object3D {
      initialized = Promise.resolve()
      dispose = splatMeshSpies.dispose
      getBoundingBox = splatMeshSpies.getBoundingBox

      constructor(opts: { fileBytes: ArrayBuffer }) {
        super()
        splatMeshSpies.ctor(opts)
      }

      override updateWorldMatrix(
        force: boolean,
        updateChildren: boolean
      ): void {
        splatMeshSpies.updateWorldMatrix(force, updateChildren)
        super.updateWorldMatrix(force, updateChildren)
      }
    }
  }
})

function makeContext(): ModelLoadContext {
  return {
    setOriginalModel: vi.fn(),
    registerOriginalMaterial: vi.fn(),
    standardMaterial: new THREE.MeshStandardMaterial(),
    materialMode: 'original'
  }
}

describe('SplatModelAdapter', () => {
  beforeEach(() => {
    splatMeshSpies.ctor.mockClear()
    splatMeshSpies.dispose.mockClear()
    splatMeshSpies.getBoundingBox.mockClear()
    splatMeshSpies.updateWorldMatrix.mockClear()
    vi.spyOn(ModelAdapterModule, 'fetchModelData').mockResolvedValue(
      new ArrayBuffer(8)
    )
  })

  it('exposes splat capabilities on the adapter', () => {
    const adapter = new SplatModelAdapter()
    expect(adapter.kind).toBe('splat')
    expect(adapter.capabilities.lighting).toBe(false)
    expect(adapter.capabilities.exportable).toBe(false)
    expect([...adapter.capabilities.materialModes]).toEqual([])
  })

  it('handles the Gaussian splat extensions', () => {
    const adapter = new SplatModelAdapter()
    expect([...adapter.extensions]).toEqual(['spz', 'splat', 'ksplat'])
  })

  it('fetches the file, builds a SplatMesh, and wraps it in a Group', async () => {
    const buf = new ArrayBuffer(128)
    vi.spyOn(ModelAdapterModule, 'fetchModelData').mockResolvedValue(buf)

    const adapter = new SplatModelAdapter()
    const ctx = makeContext()

    const result = await adapter.load(ctx, '/api/view?', 'scene.splat')

    expect(ModelAdapterModule.fetchModelData).toHaveBeenCalledWith(
      '/api/view?',
      'scene.splat'
    )
    expect(splatMeshSpies.ctor).toHaveBeenCalledWith({ fileBytes: buf })
    expect(result).toBeInstanceOf(THREE.Group)
    expect(result.children).toHaveLength(1)

    expect(ctx.setOriginalModel).toHaveBeenCalledTimes(1)
    expect(ctx.setOriginalModel).toHaveBeenCalledWith(result.children[0])
  })

  it('rotates the splat 180° around X (OpenCV → three.js convention)', async () => {
    const result = await new SplatModelAdapter().load(
      makeContext(),
      '/api/view?',
      'scene.splat'
    )

    const splat = result.children[0]
    expect(splat.quaternion.x).toBe(1)
    expect(splat.quaternion.y).toBe(0)
    expect(splat.quaternion.z).toBe(0)
    expect(splat.quaternion.w).toBe(0)
  })

  it('propagates fetch errors', async () => {
    vi.spyOn(ModelAdapterModule, 'fetchModelData').mockRejectedValue(
      new Error('Failed to fetch model: 500')
    )

    const adapter = new SplatModelAdapter()
    await expect(
      adapter.load(makeContext(), '/api/view?', 'scene.splat')
    ).rejects.toThrow('Failed to fetch model: 500')
  })

  describe('computeBounds', () => {
    it('returns the SplatMesh bounding box transformed to world space', async () => {
      const adapter = new SplatModelAdapter()
      const group = await adapter.load(
        makeContext(),
        '/api/view?',
        'scene.splat'
      )
      const splat = group.children[0]
      splat.position.set(10, 0, 0)

      const bounds = adapter.computeBounds(group)

      expect(bounds).toBeInstanceOf(THREE.Box3)
      expect(splatMeshSpies.getBoundingBox).toHaveBeenCalledWith(false)
      expect(splatMeshSpies.updateWorldMatrix).toHaveBeenCalledWith(true, false)
      // Local bbox was [-1,-1,-1]→[1,1,1]; world matrix translates by +10 X
      // (with the splat's quaternion applied to the inner mesh).
      expect(bounds!.min.x).toBeCloseTo(9)
      expect(bounds!.max.x).toBeCloseTo(11)
    })

    it('returns null when the first child is not a SplatMesh', () => {
      const adapter = new SplatModelAdapter()
      const group = new THREE.Group()
      group.add(new THREE.Mesh())

      expect(adapter.computeBounds(group)).toBeNull()
    })
  })

  describe('disposeModel', () => {
    it('calls dispose on every SplatMesh in the model tree', async () => {
      const adapter = new SplatModelAdapter()
      const group = await adapter.load(
        makeContext(),
        '/api/view?',
        'scene.splat'
      )

      adapter.disposeModel(group)

      expect(splatMeshSpies.dispose).toHaveBeenCalledOnce()
    })

    it('is a no-op when the tree has no SplatMesh', () => {
      const adapter = new SplatModelAdapter()
      const group = new THREE.Group()
      group.add(new THREE.Mesh())

      expect(() => adapter.disposeModel(group)).not.toThrow()
    })
  })

  describe('defaultCameraPose', () => {
    it('returns the (5,5,5) / (0,2.5,0) seat for self-sized splats', () => {
      const adapter = new SplatModelAdapter()
      const pose = adapter.defaultCameraPose()

      expect(pose.size.x).toBe(5)
      expect(pose.size.y).toBe(5)
      expect(pose.size.z).toBe(5)
      expect(pose.center.x).toBe(0)
      expect(pose.center.y).toBe(2.5)
      expect(pose.center.z).toBe(0)
    })
  })
})
