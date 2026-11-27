import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { MAX_MODEL_LOAD_BYTES } from '#/load3d/constants'
import type { Load3dHost } from '#/load3d/interfaces'

import { loadSubjectModel, placeInMeshFrame } from './subjectModel'

const TRIANGLE_STL = `solid triangle
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 2 0 0
vertex 0 2 0
endloop
endfacet
endsolid triangle`

function hostAnswering(respond: () => Promise<Response>): Load3dHost {
  return {
    fetchApi: vi.fn(respond),
    getPLYEngine: () => 'threejs',
    resolveImageURL: (path) => path
  }
}

const hostServing = (body: string, status = 200) =>
  hostAnswering(async () => new Response(body, { status }))

function posedSkinnedBox(pose: THREE.Vector3Tuple): THREE.SkinnedMesh {
  const geometry = new THREE.BoxGeometry(2, 4, 6)
  const { count } = geometry.getAttribute('position')
  geometry.setAttribute(
    'skinIndex',
    new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4)
  )
  geometry.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute(
      Array.from({ length: count }, () => [1, 0, 0, 0]).flat(),
      4
    )
  )
  const bone = new THREE.Bone()
  const mesh = new THREE.SkinnedMesh(geometry)
  mesh.add(bone)
  mesh.bind(new THREE.Skeleton([bone]))
  bone.position.set(...pose)
  return mesh
}

function renderedBounds(mesh: THREE.Mesh): THREE.Box3 {
  const bounds = new THREE.Box3()
  const vertex = new THREE.Vector3()
  const { count } = mesh.geometry.getAttribute('position')
  for (let index = 0; index < count; index++) {
    mesh.getVertexPosition(index, vertex)
    bounds.expandByPoint(vertex.applyMatrix4(mesh.matrixWorld))
  }
  return bounds
}

function boxMesh(size: THREE.Vector3Tuple, position: THREE.Vector3Tuple) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
  mesh.position.set(...position)
  return mesh
}

function worldBounds(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(object, true)
}

describe('placeInMeshFrame', () => {
  it('centres the bounding box on the origin', () => {
    const subject = placeInMeshFrame(boxMesh([2, 4, 6], [10, 20, 30]))

    const center = worldBounds(subject!.root).getCenter(new THREE.Vector3())
    expect(center.length()).toBeCloseTo(0)
  })

  it('scales the bounding sphere to a diameter of one', () => {
    const octahedron = new THREE.Mesh(new THREE.OctahedronGeometry(2))

    const subject = placeInMeshFrame(octahedron)

    const size = worldBounds(subject!.root).getSize(new THREE.Vector3())
    expect(size.x).toBeCloseTo(1)
    expect(size.y).toBeCloseTo(1)
    expect(size.z).toBeCloseTo(1)
  })

  it('frames a skinned mesh where its pose renders it', () => {
    const skinned = posedSkinnedBox([10, 20, 30])

    const subject = placeInMeshFrame(skinned)

    subject!.root.updateMatrixWorld(true)
    const rendered = renderedBounds(skinned)
    expect(rendered.getCenter(new THREE.Vector3()).length()).toBeCloseTo(0)
    expect(rendered.getSize(new THREE.Vector3()).length()).toBeCloseTo(1)
  })

  it('reports where the bottom of the model sits', () => {
    const subject = placeInMeshFrame(boxMesh([2, 4, 6], [10, 20, 30]))

    expect(subject!.floorY).toBeCloseTo(worldBounds(subject!.root).min.y)
    expect(subject!.floorY).toBeLessThan(0)
  })

  it('measures every mesh of a model together', () => {
    const model = new THREE.Group()
    model.add(boxMesh([1, 1, 1], [-4.5, 0, 0]), boxMesh([1, 1, 1], [4.5, 0, 0]))

    const subject = placeInMeshFrame(model)

    expect(
      worldBounds(subject!.root).getSize(new THREE.Vector3()).x
    ).toBeCloseTo(10 / Math.hypot(10, 1, 1))
  })

  it('measures every instance of an instanced mesh', () => {
    const instanced = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      2
    )
    instanced.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-4.5, 0, 0))
    instanced.setMatrixAt(1, new THREE.Matrix4().makeTranslation(4.5, 0, 0))

    const subject = placeInMeshFrame(instanced)

    expect(subject!.root.scale.x).toBeCloseTo(1 / Math.hypot(10, 1, 1))
    expect(subject!.root.position.length()).toBeCloseTo(0)
  })

  it('ignores non-finite vertices', () => {
    const mesh = boxMesh([2, 2, 2], [0, 0, 0])
    mesh.geometry.getAttribute('position').setXYZ(0, Infinity, NaN, 0)

    const subject = placeInMeshFrame(mesh)

    expect(Number.isFinite(subject!.root.scale.x)).toBe(true)
    expect(Number.isFinite(subject!.floorY)).toBe(true)
  })

  it('returns null for a model without vertices', () => {
    expect(placeInMeshFrame(new THREE.Group())).toBeNull()
  })
})

describe('loadSubjectModel', () => {
  const source = { rootFolder: 'input', subfolder: '', filename: 'a.stl' }

  it('loads a mesh file from the folder it is stored in', async () => {
    const host = hostServing(TRIANGLE_STL)

    const load = await loadSubjectModel(host, {
      rootFolder: 'output',
      subfolder: '3d/in progress',
      filename: 'triangle.stl'
    })

    expect(host.fetchApi).toHaveBeenCalledWith(
      '/view?type=output&subfolder=3d%2Fin%20progress&filename=triangle.stl',
      expect.anything()
    )
    expect(load).toEqual({
      status: 'loaded',
      object: expect.any(THREE.Object3D)
    })
  })

  it.for(['scan.ply', 'scene.splat', 'no-extension'])(
    'refuses %s as unsupported without fetching it',
    async (filename) => {
      const host = hostServing(TRIANGLE_STL)

      const load = await loadSubjectModel(host, { ...source, filename })

      expect(load).toEqual({ status: 'unsupported' })
      expect(host.fetchApi).not.toHaveBeenCalled()
    }
  )

  it('tells a missing file apart from a failure', async () => {
    const load = await loadSubjectModel(hostServing('', 404), source)

    expect(load).toEqual({ status: 'not-found' })
  })

  it('returns the cause when the server fails', async () => {
    const load = await loadSubjectModel(hostServing('', 500), source)

    expect(load).toEqual({ status: 'failed', cause: expect.any(Error) })
  })

  it('returns the cause when the file cannot be parsed', async () => {
    const load = await loadSubjectModel(hostServing('not a model'), {
      ...source,
      filename: 'broken.glb'
    })

    expect(load).toEqual({ status: 'failed', cause: expect.anything() })
  })

  it('refuses a file over the preview size limit', async () => {
    const oversized = hostAnswering(
      async () =>
        new Response('', {
          headers: { 'content-length': String(MAX_MODEL_LOAD_BYTES + 1) }
        })
    )

    const load = await loadSubjectModel(oversized, source)

    expect(load).toEqual({ status: 'too-large' })
  })

  it('reports an aborted load as cancelled', async () => {
    const abort = new AbortController()
    const aborting = hostAnswering(async () => {
      abort.abort()
      throw new DOMException('Aborted', 'AbortError')
    })

    const load = await loadSubjectModel(aborting, source, abort.signal)

    expect(load).toEqual({ status: 'cancelled' })
  })
})
