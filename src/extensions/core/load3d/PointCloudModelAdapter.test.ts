import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ModelLoadContext } from './ModelAdapter'
import * as ModelAdapterModule from './ModelAdapter'
import { PointCloudModelAdapter } from './PointCloudModelAdapter'

const mockSettingGet = vi.fn<(key: string) => unknown>()

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

    it('identifies as pointCloud with material rebuild + fit-to-viewer + lighting + export, gizmo disabled', () => {
      const adapter = new PointCloudModelAdapter()
      expect(adapter.kind).toBe('pointCloud')
      expect(adapter.capabilities.fitToViewer).toBe(true)
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
