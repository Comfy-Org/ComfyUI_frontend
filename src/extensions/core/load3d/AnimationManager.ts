import * as THREE from 'three'

import {
  AnimationItem,
  AnimationManagerInterface,
  EventManagerInterface
} from '@/extensions/core/load3d/interfaces'

export class AnimationManager implements AnimationManagerInterface {
  currentAnimation: THREE.AnimationMixer | null = null
  animationActions: THREE.AnimationAction[] = []
  animationClips: THREE.AnimationClip[] = []
  selectedAnimationIndex: number = 0
  isAnimationPlaying: boolean = false
  animationSpeed: number = 1.0

  private eventManager: EventManagerInterface
  private getCurrentModel: () => THREE.Object3D | null

  constructor(
    eventManager: EventManagerInterface,
    getCurrentModel: () => THREE.Object3D | null
  ) {
    this.eventManager = eventManager
    this.getCurrentModel = getCurrentModel
  }

  init(): void {}

  dispose(): void {
    if (this.currentAnimation) {
      this.animationActions.forEach((action) => {
        action.stop()
      })
      this.currentAnimation = null
    }
    this.animationActions = []
    this.animationClips = []
    this.selectedAnimationIndex = 0
    this.isAnimationPlaying = false
    this.animationSpeed = 1.0

    this.eventManager.emitEvent('animationListChange', [])
  }

  setupModelAnimations(model: THREE.Object3D, originalModel: any): void {
    if (this.currentAnimation) {
      this.currentAnimation.stopAllAction()
      this.animationActions = []
    }

    let animations: THREE.AnimationClip[] = []
    if (model.animations?.length > 0) {
      animations = model.animations
    } else if (originalModel && 'animations' in originalModel) {
      animations = originalModel.animations
    }

    if (animations.length > 0) {
      this.animationClips = animations
      if (model.type === 'Scene') {
        this.currentAnimation = new THREE.AnimationMixer(model)
      } else {
        this.currentAnimation = new THREE.AnimationMixer(
          this.getCurrentModel()!
        )
      }

      if (this.animationClips.length > 0) {
        this.updateSelectedAnimation(0)
      }
    }

    this.updateAnimationList()
  }

  updateAnimationList(): void {
    let updatedAnimationList: AnimationItem[] = []

    if (this.animationClips.length > 0) {
      updatedAnimationList = this.animationClips.map((clip, index) => ({
        name: clip.name || `Animation ${index + 1}`,
        index
      }))
    }

    this.eventManager.emitEvent('animationListChange', updatedAnimationList)
  }

  setAnimationSpeed(speed: number): void {
    this.animationSpeed = speed
    this.animationActions.forEach((action) => {
      action.setEffectiveTimeScale(speed)
    })
  }

  updateSelectedAnimation(index: number): void {
    if (
      !this.currentAnimation ||
      !this.animationClips ||
      index >= this.animationClips.length
    ) {
      console.warn('Invalid animation update request')
      return
    }

    this.animationActions.forEach((action) => {
      action.stop()
    })
    this.currentAnimation.stopAllAction()
    this.animationActions = []

    this.selectedAnimationIndex = index
    const clip = this.animationClips[index]

    const action = this.currentAnimation.clipAction(clip)

    action.setEffectiveTimeScale(this.animationSpeed)

    action.reset()
    action.clampWhenFinished = false
    action.loop = THREE.LoopRepeat

    if (this.isAnimationPlaying) {
      action.play()
    } else {
      action.play()
      action.paused = true
    }

    this.animationActions = [action]
  }

  toggleAnimation(play?: boolean): void {
    if (!this.currentAnimation || this.animationActions.length === 0) {
      console.warn('No animation to toggle')
      return
    }

    this.isAnimationPlaying = play ?? !this.isAnimationPlaying

    this.animationActions.forEach((action) => {
      if (this.isAnimationPlaying) {
        action.paused = false
        if (action.time === 0 || action.time === action.getClip().duration) {
          action.reset()
        }
      } else {
        action.paused = true
      }
    })
  }

  update(delta: number): void {
    if (this.currentAnimation && this.isAnimationPlaying) {
      this.currentAnimation.update(delta)
    }
  }

  reset(): void {}
}
