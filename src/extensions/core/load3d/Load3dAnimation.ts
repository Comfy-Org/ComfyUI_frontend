import { LGraphNode } from '@comfyorg/litegraph'
import * as THREE from 'three'

import { AnimationManager } from './AnimationManager'
import Load3d from './Load3d'
import { Load3DOptions } from './interfaces'

class Load3dAnimation extends Load3d {
  private animationManager: AnimationManager

  constructor(
    container: Element | HTMLElement,
    options: Load3DOptions = {
      node: {} as LGraphNode
    }
  ) {
    super(container, options)

    this.animationManager = new AnimationManager(
      this.eventManager,
      this.getCurrentModel.bind(this)
    )

    this.animationManager.init()

    this.overrideAnimationLoop()
  }

  private getCurrentModel(): THREE.Object3D | null {
    return this.modelManager.currentModel
  }

  private overrideAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
    }

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate)

      if (!this.isActive()) {
        return
      }

      if (this.previewManager.showPreview) {
        this.previewManager.updatePreviewRender()
      }

      const delta = this.clock.getDelta()

      this.animationManager.update(delta)

      this.viewHelperManager.update(delta)

      this.controlsManager.update()

      this.renderer.clear()
      this.sceneManager.renderBackground()
      this.renderer.render(
        this.sceneManager.scene,
        this.cameraManager.activeCamera
      )

      if (this.viewHelperManager.viewHelper.render) {
        this.viewHelperManager.viewHelper.render(this.renderer)
      }
    }

    animate()
  }

  async loadModel(url: string, originalFileName?: string): Promise<void> {
    await super.loadModel(url, originalFileName)

    if (this.modelManager.currentModel) {
      this.animationManager.setupModelAnimations(
        this.modelManager.currentModel,
        this.modelManager.originalModel
      )
    }
  }

  clearModel(): void {
    this.animationManager.dispose()
    super.clearModel()
  }

  updateAnimationList(): void {
    this.animationManager.updateAnimationList()
  }

  setAnimationSpeed(speed: number): void {
    this.animationManager.setAnimationSpeed(speed)
  }

  updateSelectedAnimation(index: number): void {
    this.animationManager.updateSelectedAnimation(index)
  }

  toggleAnimation(play?: boolean): void {
    this.animationManager.toggleAnimation(play)
  }

  get isAnimationPlaying(): boolean {
    return this.animationManager.isAnimationPlaying
  }

  get animationSpeed(): number {
    return this.animationManager.animationSpeed
  }

  get selectedAnimationIndex(): number {
    return this.animationManager.selectedAnimationIndex
  }

  get animationClips(): THREE.AnimationClip[] {
    return this.animationManager.animationClips
  }

  get animationActions(): THREE.AnimationAction[] {
    return this.animationManager.animationActions
  }

  get currentAnimation(): THREE.AnimationMixer | null {
    return this.animationManager.currentAnimation
  }

  remove(): void {
    this.animationManager.dispose()
    super.remove()
  }
}

export default Load3dAnimation
