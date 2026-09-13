import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { computeModelStats, hasGeometry } from './modelStats'

function makeQuadGeometry() {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3)
  )
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  return geometry
}

describe('computeModelStats', () => {
  it('counts shared edges once for indexed geometry', async () => {
    const mesh = new THREE.Mesh(makeQuadGeometry())

    await expect(computeModelStats(mesh)).resolves.toEqual({
      vertices: 4,
      edges: 5,
      triangles: 2
    })
  })

  it('welds duplicated positions so non-indexed geometry reports topology', async () => {
    const mesh = new THREE.Mesh(makeQuadGeometry().toNonIndexed())

    await expect(computeModelStats(mesh)).resolves.toEqual({
      vertices: 4,
      edges: 5,
      triangles: 2
    })
  })

  it('welds seam-duplicated vertices in indexed geometry', async () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0],
        3
      )
    )
    geometry.setIndex([0, 1, 2, 3, 4, 5])

    await expect(computeModelStats(new THREE.Mesh(geometry))).resolves.toEqual({
      vertices: 4,
      edges: 5,
      triangles: 2
    })
  })

  it('drops degenerate and duplicate triangles like Blender does', async () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3)
    )
    geometry.setIndex([0, 1, 2, 0, 2, 3, 2, 0, 1, 0, 0, 3])

    await expect(computeModelStats(new THREE.Mesh(geometry))).resolves.toEqual({
      vertices: 4,
      edges: 5,
      triangles: 2
    })
  })

  it('sums meshes across the hierarchy and multiplies instanced meshes', async () => {
    const root = new THREE.Group()
    const child = new THREE.Group()
    child.add(new THREE.Mesh(makeQuadGeometry()))
    root.add(child)
    root.add(new THREE.InstancedMesh(makeQuadGeometry(), undefined, 3))

    await expect(computeModelStats(root)).resolves.toEqual({
      vertices: 16,
      edges: 20,
      triangles: 8
    })
  })

  it('counts point clouds as vertices only', async () => {
    const points = new THREE.Points(makeQuadGeometry())

    await expect(computeModelStats(points)).resolves.toEqual({
      vertices: 4,
      edges: 0,
      triangles: 0
    })
  })

  it('stops at the next yield point once the signal is aborted', async () => {
    const vertexCount = 60_000
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(vertexCount * 3), 3)
    )
    const controller = new AbortController()

    const pending = computeModelStats(
      new THREE.Mesh(geometry),
      controller.signal
    )
    controller.abort()

    await expect(pending).rejects.toThrow(/abort/i)
  })

  it('rejects when aborted while a small mesh is still being counted', async () => {
    const controller = new AbortController()
    const pending = computeModelStats(
      new THREE.Mesh(makeQuadGeometry()),
      controller.signal
    )
    controller.abort()

    await expect(pending).rejects.toThrow(/abort/i)
  })

  it('rejects immediately for an already aborted signal', async () => {
    await expect(
      computeModelStats(new THREE.Mesh(makeQuadGeometry()), AbortSignal.abort())
    ).rejects.toThrow(/abort/i)
  })

  it('skips objects without geometry', async () => {
    const root = new THREE.Group()
    root.add(new THREE.Object3D())
    root.add(new THREE.Mesh(new THREE.BufferGeometry()))

    const stats = await computeModelStats(root)

    expect(stats.vertices).toBe(0)
    expect(hasGeometry(stats)).toBe(false)
  })
})
