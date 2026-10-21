import * as THREE from 'three'
import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { isPLYAsciiFormat } from './loader/ply'

import type { ModelLoadContext } from './ModelAdapter'
import { PointCloudModelAdapter } from './PointCloudModelAdapter'

vi.mock(import('./loader/ply'), () => ({
  isPLYAsciiFormat: vi.fn().mockReturnValue(false)
}))

const plyLoaderParse = vi.fn(() => makePLYGeometry({ withFaces: true }))
const fastPlyLoaderParse = vi.fn(() => makePLYGeometry({ withFaces: true }))

vi.mock(import('three/examples/jsm/loaders/PLYLoader'), () => ({
  PLYLoader: fromAny(
    class {
      setPath = vi.fn()
      parse = plyLoaderParse
    }
  )
}))

vi.mock(import('./loader/FastPLYLoader'), () => ({
  FastPLYLoader: class {
    parse = fastPlyLoaderParse
  }
}))

function makePLYGeometry(opts: {
  withColors?: boolean
  withFaces?: boolean
}): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)
  )
  if (opts.withColors) {
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3)
    )
  }
  if (opts.withFaces) {
    geometry.setIndex([0, 1, 2])
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
  describe('identity', () => {
    it('handles the ply extension', () => {
      const adapter = new PointCloudModelAdapter(() => 'threejs')
      expect([...adapter.extensions]).toEqual(['ply'])
    })

    it('identifies as pointCloud with material rebuild + fit-to-viewer + lighting + export, gizmo disabled', () => {
      const adapter = new PointCloudModelAdapter(() => 'threejs')
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

  describe('PLY engine', () => {
    it.for([
      { engine: 'fastply', ascii: true, parser: fastPlyLoaderParse },
      { engine: 'threejs', ascii: true, parser: plyLoaderParse },
      { engine: 'fastply', ascii: false, parser: plyLoaderParse }
    ] as const)(
      'parses with the $engine choice when ascii is $ascii',
      async ({ engine, ascii, parser }) => {
        vi.mocked(isPLYAsciiFormat).mockReturnValue(ascii)
        const adapter = new PointCloudModelAdapter(() => engine)

        await adapter.load(
          makeContext(),
          '/api/view?',
          'cloud.ply',
          async () => new ArrayBuffer(0)
        )

        expect(parser).toHaveBeenCalledOnce()
      }
    )
  })

  describe('load', () => {
    const fetchBytes = async () => new ArrayBuffer(0)

    it('returns a Group containing a Mesh for non-pointCloud modes', async () => {
      const adapter = new PointCloudModelAdapter(() => 'threejs')
      const ctx = makeContext('original')

      const result = await adapter.load(
        ctx,
        '/api/view?',
        'cloud.ply',
        fetchBytes
      )

      expect(result!.object).toBeInstanceOf(THREE.Group)
      const child = result!.object.children[0]
      expect(child).toBeInstanceOf(THREE.Mesh)
      expect(ctx.setOriginalModel).toHaveBeenCalledTimes(1)
    })

    it('returns a Group containing Points when materialMode is pointCloud', async () => {
      const adapter = new PointCloudModelAdapter(() => 'threejs')
      const ctx = makeContext('pointCloud')

      const result = await adapter.load(
        ctx,
        '/api/view?',
        'cloud.ply',
        fetchBytes
      )

      expect(result!.object).toBeInstanceOf(THREE.Group)
      const child = result!.object.children[0]
      expect(child).toBeInstanceOf(THREE.Points)
    })

    it('forces Points rendering for a face-less PLY even on materialMode=original', async () => {
      plyLoaderParse.mockReturnValueOnce(makePLYGeometry({ withFaces: false }))
      const adapter = new PointCloudModelAdapter(() => 'threejs')
      const ctx = makeContext('original')

      const result = await adapter.load(
        ctx,
        '/api/view?',
        'cloud.ply',
        fetchBytes
      )

      const child = result!.object.children[0]
      expect(child).toBeInstanceOf(THREE.Points)
    })

    it('returns narrowed materialModes capability for a face-less PLY', async () => {
      plyLoaderParse.mockReturnValueOnce(makePLYGeometry({ withFaces: false }))
      const adapter = new PointCloudModelAdapter(() => 'threejs')

      const result = await adapter.load(
        makeContext('original'),
        '/api/view?',
        'cloud.ply',
        fetchBytes
      )

      expect([...result!.capabilities.materialModes]).toEqual(['pointCloud'])
    })

    it('returns full materialModes capability for a face-bearing PLY (independent of prior loads)', async () => {
      const adapter = new PointCloudModelAdapter(() => 'threejs')
      plyLoaderParse.mockReturnValueOnce(makePLYGeometry({ withFaces: false }))
      const faceless = await adapter.load(
        makeContext('original'),
        '/api/view?',
        'cloud.ply',
        fetchBytes
      )
      expect([...faceless!.capabilities.materialModes]).toEqual(['pointCloud'])

      plyLoaderParse.mockReturnValueOnce(makePLYGeometry({ withFaces: true }))
      const faceful = await adapter.load(
        makeContext('original'),
        '/api/view?',
        'mesh.ply',
        fetchBytes
      )
      expect([...faceful!.capabilities.materialModes]).toEqual([
        'original',
        'pointCloud',
        'normal',
        'wireframe'
      ])
    })
  })
})
