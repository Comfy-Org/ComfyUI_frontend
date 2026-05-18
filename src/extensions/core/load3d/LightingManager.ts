import * as THREE from 'three'

import {
  type EventManagerInterface,
  type LightingManagerInterface
} from './interfaces'

export class LightingManager implements LightingManagerInterface {
  lights: THREE.Light[] = []
  currentIntensity: number = 3
  private scene: THREE.Scene
  private eventManager: EventManagerInterface
  private lightMultipliers = new Map<THREE.Light, number>()

  constructor(scene: THREE.Scene, eventManager: EventManagerInterface) {
    this.scene = scene
    this.eventManager = eventManager
  }

  init(): void {
    this.setupLights()
  }

  dispose(): void {
    this.lights.forEach((light) => {
      this.scene.remove(light)
    })
    this.lights = []
    this.lightMultipliers.clear()
  }

  setupLights(): void {
    const addLight = (light: THREE.Light, multiplier: number) => {
      this.scene.add(light)
      this.lights.push(light)
      this.lightMultipliers.set(light, multiplier)
    }

    addLight(new THREE.AmbientLight(0xffffff, 0.5), 0.5)

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8)
    mainLight.position.set(0, 10, 10)
    addLight(mainLight, 0.8)

    const backLight = new THREE.DirectionalLight(0xffffff, 0.5)
    backLight.position.set(0, 10, -10)
    addLight(backLight, 0.5)

    const leftFillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    leftFillLight.position.set(-10, 0, 0)
    addLight(leftFillLight, 0.3)

    const rightFillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    rightFillLight.position.set(10, 0, 0)
    addLight(rightFillLight, 0.3)

    const bottomLight = new THREE.DirectionalLight(0xffffff, 0.2)
    bottomLight.position.set(0, -10, 0)
    addLight(bottomLight, 0.2)
  }

  setLightIntensity(intensity: number): void {
    this.currentIntensity = intensity
    this.lights.forEach((light) => {
      light.intensity = intensity * (this.lightMultipliers.get(light) ?? 1)
    })

    this.eventManager.emitEvent('lightIntensityChange', intensity)
  }

  setHDRIMode(hdriActive: boolean): void {
    this.lights.forEach((light) => {
      light.visible = !hdriActive
    })
  }

  reset(): void {}
}
