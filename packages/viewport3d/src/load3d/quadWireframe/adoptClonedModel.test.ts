import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { QuadWireframeOverlay } from './QuadWireframeManager'
import { adoptClonedModel } from './adoptClonedModel'

function wireframedSource() {
  const original = new THREE.MeshStandardMaterial({ name: 'original' })
  const hidden = new THREE.MeshBasicMaterial({ visible: false })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), hidden)
  const overlay = new QuadWireframeOverlay(new THREE.BufferGeometry())
  mesh.add(overlay)
  const source = new THREE.Group().add(mesh)
  const sourceOriginals = new WeakMap<THREE.Mesh, THREE.Material>()
  sourceOriginals.set(mesh, original)
  return { source, mesh, original, sourceOriginals }
}

function firstMesh(root: THREE.Object3D): THREE.Mesh {
  const child = root.children[0]
  if (!(child instanceof THREE.Mesh)) {
    throw new Error('expected the first child to be a mesh')
  }
  return child
}

describe('adoptClonedModel', () => {
  it('strips wireframe overlays and restores the originals on the clone', () => {
    const { source, original, sourceOriginals } = wireframedSource()
    const clone = source.clone(true)
    const cloneOriginals = new WeakMap<
      THREE.Mesh,
      THREE.Material | THREE.Material[]
    >()

    adoptClonedModel(clone, source, sourceOriginals, cloneOriginals)

    const cloneMesh = firstMesh(clone)
    expect(cloneMesh.material).toBe(original)
    expect(cloneOriginals.get(cloneMesh)).toBe(original)
    expect(
      cloneMesh.children.some((c) => c instanceof QuadWireframeOverlay)
    ).toBe(false)
  })

  it('keeps model nodes that only share a name with the overlay', () => {
    const modelNode = new THREE.LineSegments(new THREE.BufferGeometry())
    modelNode.name = 'QuadWireframe'
    const source = new THREE.Group().add(modelNode)
    const clone = source.clone(true)

    adoptClonedModel(clone, source, new WeakMap())

    expect(clone.children).toHaveLength(1)
  })

  it('keeps the displayed material when the source has no snapshot for a mesh', () => {
    const material = new THREE.MeshStandardMaterial()
    const source = new THREE.Group().add(
      new THREE.Mesh(new THREE.BoxGeometry(), material)
    )
    const clone = source.clone(true)
    const cloneOriginals = new WeakMap<
      THREE.Mesh,
      THREE.Material | THREE.Material[]
    >()

    adoptClonedModel(clone, source, new WeakMap(), cloneOriginals)

    const cloneMesh = firstMesh(clone)
    expect(cloneMesh.material).toBe(material)
    expect(cloneOriginals.get(cloneMesh)).toBe(material)
  })
})
