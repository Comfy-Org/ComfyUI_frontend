import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import {
  MAX_TRIANGLE_OUTLINE,
  QuadWireframeManager,
  QuadWireframeOverlay
} from './QuadWireframeManager'
import { registerFaceSizes } from './faceSizesRegistry'

function createModel(geometry = new THREE.BoxGeometry()) {
  registerFaceSizes(geometry, new Uint32Array(6).fill(4))
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
  const group = new THREE.Group()
  group.add(mesh)
  return { group, mesh }
}

function overlayOf(mesh: THREE.Mesh): QuadWireframeOverlay | undefined {
  return mesh.children.find(
    (child): child is QuadWireframeOverlay =>
      child instanceof QuadWireframeOverlay
  )
}

describe('QuadWireframeManager', () => {
  it('outlines a cube recorded as six quads with its twelve polygon edges', () => {
    const manager = new QuadWireframeManager()
    const { group, mesh } = createModel()

    expect(manager.show(group)).toEqual([mesh])
    expect(overlayOf(mesh)!.geometry.getAttribute('position').count).toBe(24)
  })

  it('outlines meshes whose file recorded no polygons with their triangle edges', () => {
    const manager = new QuadWireframeManager()
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial()
    )

    expect(manager.show(new THREE.Group().add(mesh))).toEqual([mesh])
    expect(overlayOf(mesh)!.geometry.getAttribute('position').count).toBe(36)
  })

  it('leaves dense triangle meshes on the native wireframe but still outlines quads', () => {
    const manager = new QuadWireframeManager()
    const dense = new THREE.BufferGeometry()
    dense.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(9), 3)
    )
    dense.setIndex(
      new THREE.BufferAttribute(
        new Uint32Array((MAX_TRIANGLE_OUTLINE + 1) * 3),
        1
      )
    )
    const denseMesh = new THREE.Mesh(dense, new THREE.MeshStandardMaterial())
    const { group, mesh: quadMesh } = createModel()
    group.add(denseMesh)

    expect(manager.show(group)).toEqual([quadMesh])
    expect(overlayOf(denseMesh)).toBeUndefined()
  })

  it.for([
    {
      name: 'skinned meshes',
      make: () => {
        const geometry = new THREE.BoxGeometry()
        registerFaceSizes(geometry, new Uint32Array(6).fill(4))
        return new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial())
      }
    },
    {
      name: 'morphing meshes',
      make: () => {
        const geometry = new THREE.BoxGeometry()
        registerFaceSizes(geometry, new Uint32Array(6).fill(4))
        geometry.morphAttributes.position = [geometry.getAttribute('position')]
        return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
      }
    }
  ])('leaves $name on the triangle wireframe', ({ make }) => {
    const manager = new QuadWireframeManager()
    const mesh = make()

    expect(manager.show(new THREE.Group().add(mesh))).toEqual([])
    expect(overlayOf(mesh)).toBeUndefined()
  })

  it('leaves a single overlay behind when show is called twice', () => {
    const manager = new QuadWireframeManager()
    const { group, mesh } = createModel()

    manager.show(group)
    manager.show(group)

    expect(
      mesh.children.filter((child) => child instanceof QuadWireframeOverlay)
    ).toHaveLength(1)

    manager.hide()
    expect(overlayOf(mesh)).toBeUndefined()
  })

  it('shares one edge geometry between meshes and across show/hide cycles', () => {
    const manager = new QuadWireframeManager()
    const geometry = new THREE.BoxGeometry()
    const first = createModel(geometry)
    const second = createModel(geometry)
    const group = new THREE.Group().add(first.group, second.group)

    manager.show(group)
    const edges = overlayOf(first.mesh)!.geometry
    expect(overlayOf(second.mesh)!.geometry).toBe(edges)

    manager.hide()
    expect(overlayOf(first.mesh)).toBeUndefined()

    manager.show(group)
    expect(overlayOf(first.mesh)!.geometry).toBe(edges)
  })

  it.for([
    { name: 'clear', run: (m: QuadWireframeManager) => m.clear() },
    { name: 'dispose', run: (m: QuadWireframeManager) => m.dispose() }
  ])('$name removes overlays and releases cached edge geometry', ({ run }) => {
    const manager = new QuadWireframeManager()
    const { group, mesh } = createModel()
    manager.show(group)
    const edges = overlayOf(mesh)!.geometry
    let disposed = false
    edges.addEventListener('dispose', () => (disposed = true))

    run(manager)

    expect(overlayOf(mesh)).toBeUndefined()
    expect(disposed).toBe(true)
    manager.show(group)
    expect(overlayOf(mesh)!.geometry).not.toBe(edges)
  })
})
