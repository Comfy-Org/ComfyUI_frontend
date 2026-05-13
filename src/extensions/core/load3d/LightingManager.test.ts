import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EventManagerInterface } from './interfaces'
import { LightingManager } from './LightingManager'

function makeMockEventManager() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    emitEvent: vi.fn()
  } satisfies EventManagerInterface
}

describe('LightingManager', () => {
  let scene: THREE.Scene
  let events: ReturnType<typeof makeMockEventManager>
  let manager: LightingManager

  beforeEach(() => {
    vi.clearAllMocks()
    scene = new THREE.Scene()
    events = makeMockEventManager()
    manager = new LightingManager(scene, events)
  })

  describe('init / setupLights', () => {
    it('adds six lights — one ambient and five directionals — to the scene', () => {
      manager.init()

      expect(manager.lights).toHaveLength(6)
      const ambient = manager.lights.filter(
        (l) => l instanceof THREE.AmbientLight
      )
      const directional = manager.lights.filter(
        (l) => l instanceof THREE.DirectionalLight
      )
      expect(ambient).toHaveLength(1)
      expect(directional).toHaveLength(5)
      manager.lights.forEach((light) => {
        expect(scene.children).toContain(light)
      })
    })

    it('positions the directional lights to surround the model', () => {
      manager.init()

      const positions = manager.lights
        .filter(
          (l): l is THREE.DirectionalLight =>
            l instanceof THREE.DirectionalLight
        )
        .map((l) => l.position.toArray())

      expect(positions).toEqual(
        expect.arrayContaining([
          [0, 10, 10],
          [0, 10, -10],
          [-10, 0, 0],
          [10, 0, 0],
          [0, -10, 0]
        ])
      )
    })
  })

  describe('setLightIntensity', () => {
    it('scales each light by its stored multiplier and records the requested intensity', () => {
      manager.init()
      const ambient = manager.lights.find(
        (l): l is THREE.AmbientLight => l instanceof THREE.AmbientLight
      )!
      const mainLight = manager.lights.find(
        (l): l is THREE.DirectionalLight =>
          l instanceof THREE.DirectionalLight &&
          l.position.y === 10 &&
          l.position.z === 10
      )!

      manager.setLightIntensity(2)

      expect(manager.currentIntensity).toBe(2)
      expect(ambient.intensity).toBeCloseTo(2 * 0.5)
      expect(mainLight.intensity).toBeCloseTo(2 * 0.8)
    })

    it('emits lightIntensityChange with the new intensity', () => {
      manager.init()

      manager.setLightIntensity(1.5)

      expect(events.emitEvent).toHaveBeenCalledWith('lightIntensityChange', 1.5)
    })

    it('is a no-op (no error) when called before init', () => {
      expect(() => manager.setLightIntensity(1)).not.toThrow()
      expect(events.emitEvent).toHaveBeenCalledWith('lightIntensityChange', 1)
    })
  })

  describe('setHDRIMode', () => {
    it('hides every light when HDRI is active', () => {
      manager.init()

      manager.setHDRIMode(true)

      manager.lights.forEach((light) => {
        expect(light.visible).toBe(false)
      })
    })

    it('restores visibility when HDRI is turned off', () => {
      manager.init()
      manager.setHDRIMode(true)

      manager.setHDRIMode(false)

      manager.lights.forEach((light) => {
        expect(light.visible).toBe(true)
      })
    })
  })

  describe('dispose', () => {
    it('removes every light from the scene and clears internal state', () => {
      manager.init()
      const lightCount = manager.lights.length

      manager.dispose()

      expect(manager.lights).toEqual([])
      expect(
        scene.children.filter((c) => c instanceof THREE.Light)
      ).toHaveLength(0)
      expect(lightCount).toBeGreaterThan(0)
    })

    it('resets multipliers so subsequent setLightIntensity calls are no-ops', () => {
      manager.init()
      manager.dispose()

      manager.setLightIntensity(5)

      expect(events.emitEvent).toHaveBeenLastCalledWith(
        'lightIntensityChange',
        5
      )
    })
  })
})
