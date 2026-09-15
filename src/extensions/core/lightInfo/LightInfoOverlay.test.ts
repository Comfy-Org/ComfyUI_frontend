import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LightInfoOverlay } from './LightInfoOverlay'
import { createDefaultLight, type LightInfoEntry } from './types'

function setupOverlay(initial: LightInfoEntry[] = []) {
  const overlay = new LightInfoOverlay(initial)
  const scene = new THREE.Scene()
  overlay.attach(scene)
  return { overlay, scene }
}

function sceneLights(scene: THREE.Scene): THREE.Light[] {
  return scene.children.filter(
    (c): c is THREE.Light =>
      c instanceof THREE.Light && !(c instanceof THREE.HemisphereLight)
  )
}

describe('LightInfoOverlay', () => {
  let ctx: ReturnType<typeof setupOverlay>

  beforeEach(() => {
    ctx = setupOverlay([createDefaultLight('directional')])
  })

  afterEach(() => {
    ctx.overlay.dispose()
  })

  describe('attach / detach', () => {
    it('adds the studio scene, ambient light, and one rig per light', () => {
      expect(
        ctx.scene.children.find((c) => c.name === 'LightInfoStudio')
      ).toBeDefined()
      expect(
        ctx.scene.children.some((c) => c instanceof THREE.HemisphereLight)
      ).toBe(true)
      expect(sceneLights(ctx.scene)).toHaveLength(1)
      expect(ctx.overlay.markerMeshes()).toHaveLength(1)
    })

    it('detach removes everything the overlay added', () => {
      ctx.overlay.detach()

      expect(
        ctx.scene.children.find((c) => c.name === 'LightInfoStudio')
      ).toBeUndefined()
      expect(ctx.scene.children.some((c) => c instanceof THREE.Light)).toBe(
        false
      )
    })
  })

  describe('applyLights', () => {
    it('creates one scene light per entry, matching types', () => {
      ctx.overlay.applyLights(
        [
          createDefaultLight('directional'),
          createDefaultLight('point'),
          createDefaultLight('spot')
        ],
        0
      )

      const lights = sceneLights(ctx.scene)
      expect(lights).toHaveLength(3)
      expect(lights.some((l) => l instanceof THREE.DirectionalLight)).toBe(true)
      expect(lights.some((l) => l instanceof THREE.PointLight)).toBe(true)
      expect(lights.some((l) => l instanceof THREE.SpotLight)).toBe(true)
    })

    it('removes rigs when lights are removed', () => {
      ctx.overlay.applyLights(
        [createDefaultLight('directional'), createDefaultLight('point')],
        0
      )
      ctx.overlay.applyLights([createDefaultLight('point')], 0)

      expect(sceneLights(ctx.scene)).toHaveLength(1)
      expect(ctx.overlay.markerMeshes()).toHaveLength(1)
    })

    it('applies color and intensity per light', () => {
      ctx.overlay.applyLights(
        [
          { ...createDefaultLight('directional'), color: '#ff0000' },
          { ...createDefaultLight('point'), intensity: 42 }
        ],
        0
      )

      const lights = sceneLights(ctx.scene)
      const directional = lights.find(
        (l) => l instanceof THREE.DirectionalLight
      )!
      const point = lights.find((l) => l instanceof THREE.PointLight)!
      expect(directional.color.getHexString()).toBe('ff0000')
      expect(point.intensity).toBe(42)
    })

    it('configures spot cone angle, penumbra and range', () => {
      ctx.overlay.applyLights(
        [
          {
            ...createDefaultLight('spot'),
            range: 20,
            innerConeAngle: 15,
            outerConeAngle: 30
          }
        ],
        0
      )

      const spot = sceneLights(ctx.scene)[0] as THREE.SpotLight
      expect(spot.angle).toBeCloseTo((30 * Math.PI) / 180)
      expect(spot.penumbra).toBeCloseTo(0.5)
      expect(spot.distance).toBe(20)
    })

    it('maps castShadow and radius onto the scene light shadow', () => {
      ctx.overlay.applyLights(
        [
          { ...createDefaultLight('point'), castShadow: false },
          { ...createDefaultLight('point'), radius: 0 },
          { ...createDefaultLight('point'), radius: 0.5 }
        ],
        0
      )

      const [off, hard, soft] = sceneLights(ctx.scene).filter(
        (l): l is THREE.PointLight => l instanceof THREE.PointLight
      )
      expect(off.castShadow).toBe(false)
      expect(hard.castShadow).toBe(true)
      expect(hard.shadow.radius).toBe(1)
      expect(soft.shadow.radius).toBeGreaterThan(hard.shadow.radius)
    })

    it('tags markers with their light index and scales the selected one', () => {
      ctx.overlay.applyLights(
        [createDefaultLight('directional'), createDefaultLight('point')],
        1
      )

      const markers = ctx.overlay.markerMeshes()
      expect(markers.map((m) => m.userData.lightIndex)).toEqual([0, 1])
      expect(markers[1].scale.x).toBeGreaterThan(markers[0].scale.x)
    })

    it('clamps the selected index to the list length', () => {
      ctx.overlay.applyLights([createDefaultLight('directional')], 5)
      expect(ctx.overlay.getSelectedIndex()).toBe(0)
    })

    it('getLights returns a copy detached from internal state', () => {
      const lights = ctx.overlay.getLights()
      lights[0].intensity = 999
      expect(ctx.overlay.getLights()[0].intensity).not.toBe(999)
    })
  })

  describe('helper visibility', () => {
    it('shows the helper only for the selected light', () => {
      ctx.overlay.applyLights(
        [createDefaultLight('directional'), createDefaultLight('point')],
        0
      )

      const directionalHelper = ctx.scene.children.find(
        (c) => c instanceof THREE.DirectionalLightHelper
      )
      const pointHelper = ctx.scene.children.find(
        (c) => c instanceof THREE.PointLightHelper
      )
      expect(directionalHelper?.visible).toBe(true)
      expect(pointHelper?.visible).toBe(false)
    })

    it('setHelpersVisible(false) hides markers and helpers', () => {
      ctx.overlay.setHelpersVisible(false)

      expect(ctx.overlay.markerMeshes()[0].visible).toBe(false)
      expect(
        ctx.scene.children.some(
          (c) => c instanceof THREE.DirectionalLightHelper && c.visible
        )
      ).toBe(false)
    })
  })
})
