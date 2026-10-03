import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CameraInfoOverlay } from './CameraInfoOverlay'
import { DEFAULT_CAMERA_INFO_STATE } from './types'
import type { CameraInfoState } from './types'

function setupOverlay(initial?: Partial<CameraInfoState>) {
  const overlay = new CameraInfoOverlay({
    ...DEFAULT_CAMERA_INFO_STATE,
    ...initial
  })
  const scene = new THREE.Scene()
  overlay.attach(scene)
  return { overlay, scene }
}

function findByName(scene: THREE.Scene, name: string): THREE.Object3D | null {
  for (const child of scene.children) {
    if (child.name === name) return child
  }
  return null
}

describe('CameraInfoOverlay', () => {
  let ctx: ReturnType<typeof setupOverlay>

  beforeEach(() => {
    ctx = setupOverlay()
  })

  afterEach(() => {
    ctx.overlay.dispose()
  })

  describe('attach / detach', () => {
    it('adds reference + subject cameras + camera helper to the scene', () => {
      expect(findByName(ctx.scene, 'CameraInfoReference')).not.toBeNull()
      const subjectCameras = ctx.scene.children.filter(
        (c) =>
          c instanceof THREE.PerspectiveCamera ||
          c instanceof THREE.OrthographicCamera
      )
      expect(subjectCameras).toHaveLength(2)
      expect(
        ctx.scene.children.some((c) => c instanceof THREE.CameraHelper)
      ).toBe(true)
    })

    it('detach removes everything the overlay added', () => {
      ctx.overlay.detach()

      expect(findByName(ctx.scene, 'CameraInfoReference')).toBeNull()
      expect(
        ctx.scene.children.some(
          (c) =>
            c instanceof THREE.PerspectiveCamera ||
            c instanceof THREE.OrthographicCamera ||
            c instanceof THREE.CameraHelper
        )
      ).toBe(false)
    })

    it('dispose also detaches its scene objects', () => {
      ctx.overlay.dispose()

      expect(findByName(ctx.scene, 'CameraInfoReference')).toBeNull()
      expect(
        ctx.scene.children.some(
          (c) =>
            c instanceof THREE.PerspectiveCamera ||
            c instanceof THREE.OrthographicCamera ||
            c instanceof THREE.CameraHelper
        )
      ).toBe(false)
    })
  })

  describe('applyState — orbit mode', () => {
    it('positions the active subject camera per yaw / pitch / distance', () => {
      ctx.overlay.applyState({
        ...DEFAULT_CAMERA_INFO_STATE,
        mode: 'orbit',
        target: { x: 0, y: 0, z: 0 },
        orbit: { yaw: 0, pitch: 0, distance: 5 }
      })

      const cam = ctx.overlay.getSubjectCamera()
      expect(cam.position.x).toBeCloseTo(0)
      expect(cam.position.y).toBeCloseTo(0)
      expect(cam.position.z).toBeCloseTo(5)
    })

    it('updates fov on the perspective subject camera', () => {
      ctx.overlay.applyState({
        ...DEFAULT_CAMERA_INFO_STATE,
        fov: 70
      })

      const cam = ctx.overlay.getSubjectCamera() as THREE.PerspectiveCamera
      expect(cam.fov).toBe(70)
    })
  })

  describe('camera type swap', () => {
    it('toggling to orthographic swaps the active subject camera and points the helper at it', () => {
      ctx.overlay.applyState({
        ...DEFAULT_CAMERA_INFO_STATE,
        cameraType: 'orthographic'
      })

      expect(ctx.overlay.getSubjectCamera()).toBeInstanceOf(
        THREE.OrthographicCamera
      )
      const newHelper = ctx.scene.children.find(
        (c): c is THREE.CameraHelper => c instanceof THREE.CameraHelper
      )
      expect(newHelper).toBeDefined()
      expect(newHelper?.camera).toBe(ctx.overlay.getSubjectCamera())
      expect(
        ctx.scene.children.filter((c) => c instanceof THREE.CameraHelper)
      ).toHaveLength(1)
    })
  })

  describe('POV (onActiveCameraChange)', () => {
    it('hides the camera helper when the render camera IS the subject camera', () => {
      const subjectCam = ctx.overlay.getSubjectCamera()

      ctx.overlay.onActiveCameraChange(subjectCam)

      const helper = ctx.scene.children.find(
        (c): c is THREE.CameraHelper => c instanceof THREE.CameraHelper
      )!
      expect(helper.visible).toBe(false)
    })

    it('shows the camera helper when render camera is some other camera', () => {
      const subjectCam = ctx.overlay.getSubjectCamera()
      ctx.overlay.onActiveCameraChange(subjectCam)
      const otherCam = new THREE.PerspectiveCamera()

      ctx.overlay.onActiveCameraChange(otherCam)

      const helper = ctx.scene.children.find(
        (c): c is THREE.CameraHelper => c instanceof THREE.CameraHelper
      )!
      expect(helper.visible).toBe(true)
    })
  })

  describe('getState immutability', () => {
    it('returns a deep clone the caller cannot mutate to affect overlay', () => {
      const snapshot = ctx.overlay.getState()
      snapshot.orbit.yaw = 999

      const next = ctx.overlay.getState()
      expect(next.orbit.yaw).not.toBe(999)
      expect(next.target).not.toBe(snapshot.target)
    })
  })
})
