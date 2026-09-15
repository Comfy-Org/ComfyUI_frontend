import * as THREE from 'three'

import type { SceneOverlay } from '@/extensions/core/load3d/interfaces'

import {
  cloneLights,
  lightTarget,
  type LightInfoEntry,
  type LightInfoType
} from './types'

const SPHERE_RADIUS = 1
const SPHERE_SEGMENTS = 64
const SPHERE_COLOR = 0xcccccc
const GROUND_SIZE = 40
const GROUND_Y = -1
const GROUND_COLOR = 0x8a8a8a
const AMBIENT_INTENSITY = 0.2
const AMBIENT_SKY_COLOR = 0xffffff
const AMBIENT_GROUND_COLOR = 0x808080
const MARKER_RADIUS = 0.1
const MARKER_SELECTED_SCALE = 1.4
const SHADOW_MAP_SIZE = 1024
const SHADOW_BIAS = -0.0005
const DIRECTIONAL_SHADOW_HALF = GROUND_SIZE / 2
const SHADOW_BLUR_TEXELS_PER_UNIT = 20
const SHADOW_BLUR_TEXELS_PER_DEGREE = 2

const DEG2RAD = Math.PI / 180

type SceneLight = THREE.DirectionalLight | THREE.PointLight | THREE.SpotLight

interface LightRig {
  type: LightInfoType
  light: SceneLight
  helper: THREE.Object3D & { update?: () => void; dispose: () => void }
  marker: THREE.Mesh
}

function createSceneLight(type: LightInfoType): SceneLight {
  if (type === 'point') return new THREE.PointLight()
  if (type === 'spot') return new THREE.SpotLight()
  return new THREE.DirectionalLight()
}

function createHelper(light: SceneLight): LightRig['helper'] {
  if (light instanceof THREE.PointLight) {
    return new THREE.PointLightHelper(light, 0.3)
  }
  if (light instanceof THREE.SpotLight) {
    return new THREE.SpotLightHelper(light)
  }
  return new THREE.DirectionalLightHelper(light, 0.5)
}

export class LightInfoOverlay implements SceneOverlay {
  private scene: THREE.Scene | null = null
  private lights: LightInfoEntry[] = []
  private selectedIndex = -1

  private readonly studioGroup: THREE.Group
  private readonly sphere: THREE.Mesh
  private readonly ground: THREE.Mesh
  private readonly ambientLight: THREE.HemisphereLight
  private rigs: LightRig[] = []

  private helpersOn = true
  private disposed = false

  constructor(initialLights: LightInfoEntry[] = []) {
    this.lights = cloneLights(initialLights)
    this.selectedIndex = this.lights.length ? 0 : -1

    this.sphere = new THREE.Mesh(
      new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS),
      new THREE.MeshStandardMaterial({
        color: SPHERE_COLOR,
        roughness: 0.8,
        metalness: 0
      })
    )
    this.sphere.castShadow = true
    this.sphere.receiveShadow = true

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
      new THREE.MeshStandardMaterial({
        color: GROUND_COLOR,
        roughness: 1,
        metalness: 0
      })
    )
    this.ground.rotation.x = -Math.PI / 2
    this.ground.position.y = GROUND_Y
    this.ground.receiveShadow = true

    this.studioGroup = new THREE.Group()
    this.studioGroup.name = 'LightInfoStudio'
    this.studioGroup.add(this.sphere)
    this.studioGroup.add(this.ground)

    this.ambientLight = new THREE.HemisphereLight(
      AMBIENT_SKY_COLOR,
      AMBIENT_GROUND_COLOR,
      AMBIENT_INTENSITY
    )
  }

  attach(scene: THREE.Scene): void {
    this.scene = scene
    scene.add(this.studioGroup)
    scene.add(this.ambientLight)
    this.rebuildRigs()
    this.lights.forEach((light, i) => this.applyLightToRig(light, i))
    this.refreshHelperVisibility()
    this.updateHelpers()
  }

  detach(): void {
    if (!this.scene) return
    this.removeRigs()
    this.scene.remove(this.studioGroup)
    this.scene.remove(this.ambientLight)
    this.scene = null
  }

  update(_delta: number): void {
    this.updateHelpers()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.removeRigs()
    this.sphere.geometry.dispose()
    ;(this.sphere.material as THREE.Material).dispose()
    this.ground.geometry.dispose()
    ;(this.ground.material as THREE.Material).dispose()
  }

  getLights(): LightInfoEntry[] {
    return cloneLights(this.lights)
  }

  getSelectedIndex(): number {
    return this.selectedIndex
  }

  getSelectedLight(): LightInfoEntry | null {
    const light = this.lights[this.selectedIndex]
    return light ? cloneLights([light])[0] : null
  }

  applyLights(lights: LightInfoEntry[], selectedIndex: number): void {
    this.lights = cloneLights(lights)
    this.selectedIndex = Math.min(selectedIndex, this.lights.length - 1)
    if (!this.scene) return
    const typesMatch =
      this.rigs.length === this.lights.length &&
      this.rigs.every((rig, i) => rig.type === this.lights[i].type)
    if (!typesMatch) this.rebuildRigs()
    this.lights.forEach((light, i) => this.applyLightToRig(light, i))
    this.refreshHelperVisibility()
    this.updateHelpers()
  }

  markerMeshes(): THREE.Object3D[] {
    return this.rigs.map((rig) => rig.marker)
  }

  setHelpersVisible(visible: boolean): void {
    this.helpersOn = visible
    this.refreshHelperVisibility()
  }

  private rebuildRigs(): void {
    this.removeRigs()
    const scene = this.scene
    if (!scene) return
    this.rigs = this.lights.map((entry, i) => {
      const light = createSceneLight(entry.type)
      light.castShadow = true
      light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
      light.shadow.bias = SHADOW_BIAS
      if (light instanceof THREE.DirectionalLight) {
        light.shadow.camera.left = -DIRECTIONAL_SHADOW_HALF
        light.shadow.camera.right = DIRECTIONAL_SHADOW_HALF
        light.shadow.camera.top = DIRECTIONAL_SHADOW_HALF
        light.shadow.camera.bottom = -DIRECTIONAL_SHADOW_HALF
      }
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(MARKER_RADIUS, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      )
      marker.name = `LightInfoEmitterMarker${i}`
      const helper = createHelper(light)
      scene.add(light)
      if (hasTargetObject(light)) scene.add(light.target)
      scene.add(marker)
      scene.add(helper)
      return { type: entry.type, light, helper, marker }
    })
  }

  private removeRigs(): void {
    for (const rig of this.rigs) {
      this.scene?.remove(rig.light)
      if (hasTargetObject(rig.light)) this.scene?.remove(rig.light.target)
      this.scene?.remove(rig.marker)
      this.scene?.remove(rig.helper)
      rig.helper.dispose()
      rig.marker.geometry.dispose()
      ;(rig.marker.material as THREE.Material).dispose()
      rig.light.dispose()
    }
    this.rigs = []
  }

  private applyLightToRig(entry: LightInfoEntry, index: number): void {
    const rig = this.rigs[index]
    if (!rig) return
    const color = new THREE.Color(entry.color)
    const { light, marker } = rig

    light.color.copy(color)
    light.intensity = entry.intensity
    light.position.set(entry.position.x, entry.position.y, entry.position.z)
    light.castShadow = entry.castShadow !== false
    light.shadow.radius = 1 + shadowBlurTexels(entry)

    const target = lightTarget(entry)
    if (light instanceof THREE.SpotLight) {
      light.target.position.set(target.x, target.y, target.z)
      light.target.updateMatrixWorld(true)
      light.distance = entry.range ?? 0
      light.angle = (entry.outerConeAngle ?? 45) * DEG2RAD
      light.penumbra = spotPenumbra(entry)
    } else if (light instanceof THREE.PointLight) {
      light.distance = entry.range ?? 0
    } else {
      light.target.position.set(target.x, target.y, target.z)
      light.target.updateMatrixWorld(true)
    }
    light.updateMatrixWorld(true)

    marker.position.set(entry.position.x, entry.position.y, entry.position.z)
    marker.userData.lightIndex = index
    marker.userData.handleType = String(index)
    ;(marker.material as THREE.MeshBasicMaterial).color.copy(color)
    marker.scale.setScalar(
      index === this.selectedIndex ? MARKER_SELECTED_SCALE : 1
    )
  }

  private refreshHelperVisibility(): void {
    this.rigs.forEach((rig, i) => {
      rig.marker.visible = this.helpersOn
      rig.helper.visible = this.helpersOn && i === this.selectedIndex
    })
  }

  private updateHelpers(): void {
    for (const rig of this.rigs) rig.helper.update?.()
  }
}

function hasTargetObject(
  light: SceneLight
): light is THREE.DirectionalLight | THREE.SpotLight {
  return (
    light instanceof THREE.DirectionalLight || light instanceof THREE.SpotLight
  )
}

function shadowBlurTexels(entry: LightInfoEntry): number {
  const radius = Math.max(entry.radius ?? 0, 0)
  return entry.type === 'directional'
    ? radius * SHADOW_BLUR_TEXELS_PER_DEGREE
    : radius * SHADOW_BLUR_TEXELS_PER_UNIT
}

function spotPenumbra(entry: LightInfoEntry): number {
  const outer = Math.max(entry.outerConeAngle ?? 45, 1e-3)
  const inner = Math.min(entry.innerConeAngle ?? 30, outer)
  return Math.min(Math.max(1 - inner / outer, 0), 1)
}
