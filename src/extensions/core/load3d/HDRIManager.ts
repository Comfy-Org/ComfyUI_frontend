import * as THREE from 'three'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader'

import Load3dUtils from './Load3dUtils'
import type { EventManagerInterface } from './interfaces'

export class HDRIManager {
  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  private pmremGenerator: THREE.PMREMGenerator
  private eventManager: EventManagerInterface

  private hdriTexture: THREE.Texture | null = null
  private envMapTarget: THREE.WebGLRenderTarget | null = null

  private _isEnabled: boolean = false
  private _showAsBackground: boolean = false
  private _intensity: number = 1

  get isEnabled() {
    return this._isEnabled
  }

  get showAsBackground() {
    return this._showAsBackground
  }

  get intensity() {
    return this._intensity
  }

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    eventManager: EventManagerInterface
  ) {
    this.scene = scene
    this.renderer = renderer
    this.pmremGenerator = new THREE.PMREMGenerator(renderer)
    this.pmremGenerator.compileEquirectangularShader()
    this.eventManager = eventManager
  }

  async loadHDRI(url: string): Promise<void> {
    const ext = Load3dUtils.getFilenameExtension(url)

    let newTexture: THREE.Texture
    if (ext === 'exr') {
      newTexture = await new Promise<THREE.Texture>((resolve, reject) => {
        new EXRLoader().load(url, resolve, undefined, reject)
      })
    } else {
      newTexture = await new Promise<THREE.Texture>((resolve, reject) => {
        new RGBELoader().load(url, resolve, undefined, reject)
      })
    }

    newTexture.mapping = THREE.EquirectangularReflectionMapping
    const newEnvMapTarget = this.pmremGenerator.fromEquirectangular(newTexture)

    // Dispose old resources only after the new one is ready
    this.hdriTexture?.dispose()
    this.envMapTarget?.dispose()
    this.hdriTexture = newTexture
    this.envMapTarget = newEnvMapTarget

    if (this._isEnabled) {
      this.applyToScene()
    }
  }

  setEnabled(enabled: boolean): void {
    this._isEnabled = enabled
    if (enabled) {
      if (this.envMapTarget) {
        this.applyToScene()
      }
    } else {
      this.removeFromScene()
    }
  }

  setShowAsBackground(show: boolean): void {
    this._showAsBackground = show
    if (this._isEnabled && this.envMapTarget) {
      this.applyToScene()
    }
  }

  setIntensity(intensity: number): void {
    this._intensity = intensity
    if (this._isEnabled) {
      this.scene.environmentIntensity = intensity
    }
  }

  private applyToScene(): void {
    const envMap = this.envMapTarget?.texture
    if (!envMap) return
    this.scene.environment = envMap
    this.scene.environmentIntensity = this._intensity
    this.scene.background = this._showAsBackground ? this.hdriTexture : null
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.eventManager.emitEvent('hdriChange', {
      enabled: this._isEnabled,
      showAsBackground: this._showAsBackground
    })
  }

  private removeFromScene(): void {
    this.scene.environment = null
    if (this.scene.background === this.hdriTexture) {
      this.scene.background = null
    }
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.eventManager.emitEvent('hdriChange', {
      enabled: false,
      showAsBackground: this._showAsBackground
    })
  }

  private clearResources(): void {
    this.removeFromScene()
    this.hdriTexture?.dispose()
    this.envMapTarget?.dispose()
    this.hdriTexture = null
    this.envMapTarget = null
  }

  clear(): void {
    this.clearResources()
    this._isEnabled = false
  }

  dispose(): void {
    this.clearResources()
    this.pmremGenerator.dispose()
  }
}
