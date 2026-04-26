import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ModelLoadContext } from './ModelAdapter'
import * as ModelAdapterModule from './ModelAdapter'
import { SplatModelAdapter } from './SplatModelAdapter'

const { splatMeshCtor } = vi.hoisted(() => ({
  splatMeshCtor: vi.fn<(opts: { fileBytes: ArrayBuffer }) => void>()
}))

vi.mock('@sparkjsdev/spark', async () => {
  const three = await import('three')
  return {
    SplatMesh: class extends three.Object3D {
      constructor(opts: { fileBytes: ArrayBuffer }) {
        super()
        splatMeshCtor(opts)
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
    splatMeshCtor.mockReset()
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
    expect(splatMeshCtor).toHaveBeenCalledWith({ fileBytes: buf })
    expect(result).toBeInstanceOf(THREE.Group)
    expect(result.children).toHaveLength(1)

    expect(ctx.setOriginalModel).toHaveBeenCalledTimes(1)
    expect(ctx.setOriginalModel).toHaveBeenCalledWith(result.children[0])
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
})
