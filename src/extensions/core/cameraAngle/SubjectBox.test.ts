import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { SubjectBox } from './SubjectBox'
import { MAX_SUBJECT_DISTANCE, SUBJECT_CENTER, SUBJECT_HEIGHT } from './types'

function fakeTexture(width: number, height: number): THREE.Texture {
  const texture = new THREE.Texture()
  texture.image = { width, height }
  return texture
}

function subjectMesh(scene: THREE.Scene): THREE.Mesh {
  return scene.getObjectByName('CameraAngleSubject')?.children[0] as THREE.Mesh
}

function disposeListener(resource: THREE.Texture) {
  const listener = vi.fn()
  resource.addEventListener('dispose', listener)
  return listener
}

function boxSize(scene: THREE.Scene): THREE.Vector3 {
  const geometry = subjectMesh(scene).geometry
  geometry.computeBoundingBox()
  return geometry.boundingBox!.getSize(new THREE.Vector3())
}

function frontTexture(scene: THREE.Scene): THREE.Texture | null {
  const materials = subjectMesh(scene).material as THREE.MeshBasicMaterial[]
  return materials[4].map
}

describe('SubjectBox', () => {
  it('places the subject camera on the orbit and aims it at the subject centre', () => {
    const box = new SubjectBox({ horizontal: 0, vertical: 0, zoom: 0 })
    const camera = box.getSubjectCamera()

    expect(camera.position.x).toBeCloseTo(SUBJECT_CENTER.x)
    expect(camera.position.y).toBeCloseTo(SUBJECT_CENTER.y)
    expect(camera.position.z).toBeCloseTo(MAX_SUBJECT_DISTANCE)

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion
    )
    expect(forward.z).toBeCloseTo(-1)
  })

  it('moves the camera when state is applied', () => {
    const box = new SubjectBox()
    box.applyState({ horizontal: 90, vertical: 0, zoom: 0 })

    expect(box.getSubjectCamera().position.x).toBeCloseTo(MAX_SUBJECT_DISTANCE)
    expect(box.getState()).toEqual({ horizontal: 90, vertical: 0, zoom: 0 })
  })

  it('stays a unit cube and centre-crops the image onto the front face', async () => {
    const loadTexture = vi
      .fn<(url: string) => Promise<THREE.Texture>>()
      .mockResolvedValueOnce(fakeTexture(400, 100))
      .mockResolvedValueOnce(fakeTexture(100, 400))
    const box = new SubjectBox(undefined, { loadTexture })
    const scene = new THREE.Scene()
    box.attach(scene)

    await box.setImage('http://example/wide.png')
    expect(loadTexture).toHaveBeenCalledWith('http://example/wide.png')
    expect(box.hasImage()).toBe(true)
    expect(boxSize(scene).toArray()).toEqual([
      SUBJECT_HEIGHT,
      SUBJECT_HEIGHT,
      SUBJECT_HEIGHT
    ])
    const wide = frontTexture(scene)!
    expect(wide.repeat.toArray()).toEqual([0.25, 1])
    expect(wide.offset.toArray()).toEqual([0.375, 0])
    const wideDisposed = disposeListener(wide)

    await expect(box.setImage('http://example/tall.png')).resolves.toBe(true)
    const tall = frontTexture(scene)!
    expect(tall.repeat.toArray()).toEqual([1, 0.25])
    expect(tall.offset.toArray()).toEqual([0, 0.375])
    expect(wideDisposed).toHaveBeenCalledOnce()
    const tallDisposed = disposeListener(tall)

    await expect(box.setImage(null)).resolves.toBe(true)
    expect(box.hasImage()).toBe(false)
    expect(frontTexture(scene)).toBeNull()
    expect(tallDisposed).toHaveBeenCalledOnce()
  })

  it('keeps only the latest requested image when loads overlap', async () => {
    let resolveFirst: (texture: THREE.Texture) => void = () => {}
    const first = new Promise<THREE.Texture>((resolve) => {
      resolveFirst = resolve
    })
    const loadTexture = vi
      .fn<(url: string) => Promise<THREE.Texture>>()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(fakeTexture(100, 300))
    const box = new SubjectBox(undefined, { loadTexture })

    const firstLoad = box.setImage('first')
    await expect(box.setImage('second')).resolves.toBe(true)
    const stale = fakeTexture(300, 100)
    const staleDisposed = disposeListener(stale)
    resolveFirst(stale)

    await expect(firstLoad).resolves.toBe(false)
    expect(box.getAspect()).toBeCloseTo(1 / 3)
    expect(staleDisposed).toHaveBeenCalledOnce()
  })

  it('ignores a failed image load', async () => {
    const box = new SubjectBox(undefined, {
      loadTexture: () => Promise.reject(new Error('network'))
    })
    await expect(box.setImage('broken')).resolves.toBe(false)
    expect(box.hasImage()).toBe(false)
  })

  it('detaches from the scene and releases every GPU resource on dispose', async () => {
    const box = new SubjectBox(undefined, {
      loadTexture: async () => fakeTexture(64, 64)
    })
    const scene = new THREE.Scene()
    box.attach(scene)
    await box.setImage('http://example/image.png')
    const mesh = subjectMesh(scene)
    const edges = scene.getObjectByName('CameraAngleSubject')!
      .children[1] as THREE.LineSegments
    const owned: THREE.EventDispatcher<{ dispose: object }>[] = [
      mesh.geometry,
      edges.geometry,
      ...new Set(mesh.material as THREE.Material[]),
      frontTexture(scene)!
    ]
    const disposed = owned.map((resource) => {
      const listener = vi.fn()
      resource.addEventListener('dispose', listener)
      return listener
    })

    box.dispose()

    expect(scene.children).toHaveLength(0)
    for (const listener of disposed) expect(listener).toHaveBeenCalledOnce()
  })
})
