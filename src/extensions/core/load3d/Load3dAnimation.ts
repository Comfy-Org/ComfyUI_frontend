import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import * as THREE from 'three'
import { createApp } from 'vue'

import Load3DAnimationControls from '@/components/load3d/Load3DAnimationControls.vue'
import Load3d from '@/extensions/core/load3d/Load3d'

class Load3dAnimation extends Load3d {
  currentAnimation: THREE.AnimationMixer | null = null
  animationActions: THREE.AnimationAction[] = []
  animationClips: THREE.AnimationClip[] = []
  selectedAnimationIndex: number = 0
  isAnimationPlaying: boolean = false

  animationSpeed: number = 1.0

  constructor(
    container: Element | HTMLElement,
    options: { createPreview?: boolean } = {}
  ) {
    super(container, options)
  }

  protected mountControls(options: { createPreview?: boolean } = {}) {
    const controlsMount = document.createElement('div')
    controlsMount.style.pointerEvents = 'auto'
    this.controlsContainer.appendChild(controlsMount)

    this.controlsApp = createApp(Load3DAnimationControls, {
      backgroundColor: '#282828',
      showGrid: true,
      showPreview: options.createPreview,
      animations: [],
      playing: false,
      lightIntensity: 5,
      showLightIntensityButton: true,
      fov: 75,
      showFOVButton: true,
      showPreviewButton: options.createPreview,
      onToggleCamera: () => this.toggleCamera(),
      onToggleGrid: (show: boolean) => this.toggleGrid(show),
      onTogglePreview: (show: boolean) => this.togglePreview(show),
      onUpdateBackgroundColor: (color: string) =>
        this.setBackgroundColor(color),
      onTogglePlay: (play: boolean) => this.toggleAnimation(play),
      onSpeedChange: (speed: number) => this.setAnimationSpeed(speed),
      onAnimationChange: (selectedAnimation: number) =>
        this.updateSelectedAnimation(selectedAnimation),
      onUpdateLightIntensity: (lightIntensity: number) =>
        this.setLightIntensity(lightIntensity),
      onUpdateFOV: (fov: number) => this.setFOV(fov)
    })

    this.controlsApp.use(PrimeVue)
    this.controlsApp.directive('tooltip', Tooltip)
    this.controlsApp.mount(controlsMount)
  }

  updateAnimationList() {
    if (this.controlsApp?._instance?.exposed) {
      if (this.animationClips.length > 0) {
        this.controlsApp._instance.exposed.animations.value =
          this.animationClips.map((clip, index) => ({
            name: clip.name || `Animation ${index + 1}`,
            index
          }))
      } else {
        this.controlsApp._instance.exposed.animations.value = []
      }
    }
  }

  protected async setupModel(model: THREE.Object3D) {
    await super.setupModel(model)

    if (this.currentAnimation) {
      this.currentAnimation.stopAllAction()
      this.animationActions = []
    }

    let animations: THREE.AnimationClip[] = []
    if (model.animations?.length > 0) {
      animations = model.animations
    } else if (this.originalModel && 'animations' in this.originalModel) {
      animations = (
        this.originalModel as unknown as { animations: THREE.AnimationClip[] }
      ).animations
    }

    if (animations.length > 0) {
      this.animationClips = animations
      if (model.type === 'Scene') {
        this.currentAnimation = new THREE.AnimationMixer(model)
      } else {
        this.currentAnimation = new THREE.AnimationMixer(this.currentModel!)
      }

      if (this.animationClips.length > 0) {
        this.updateSelectedAnimation(0)
      }
    }

    this.updateAnimationList()
  }

  setAnimationSpeed(speed: number) {
    this.animationSpeed = speed
    this.animationActions.forEach((action) => {
      action.setEffectiveTimeScale(speed)
    })
  }

  updateSelectedAnimation(index: number) {
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

    if (this.controlsApp?._instance?.exposed) {
      this.controlsApp._instance.exposed.selectedAnimation.value = index
    }
  }

  clearModel() {
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

    if (this.controlsApp?._instance?.exposed) {
      this.controlsApp._instance.exposed.animations.value = []
      this.controlsApp._instance.exposed.selectedAnimation.value = 0
    }

    super.clearModel()
  }

  toggleAnimation(play?: boolean) {
    if (!this.currentAnimation || this.animationActions.length === 0) {
      console.warn('No animation to toggle')
      return
    }

    this.isAnimationPlaying = play ?? !this.isAnimationPlaying

    if (this.controlsApp?._instance?.exposed) {
      this.controlsApp._instance.exposed.playing.value = this.isAnimationPlaying
    }

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

  startAnimation() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate)

      if (this.showPreview) {
        this.updatePreviewRender()
      }

      const delta = this.clock.getDelta()

      if (this.currentAnimation && this.isAnimationPlaying) {
        this.currentAnimation.update(delta)
      }

      this.controls.update()

      this.renderer.clear()

      this.renderer.render(this.scene, this.activeCamera)

      if (this.viewHelper.animating) {
        this.viewHelper.update(delta)

        if (!this.viewHelper.animating) {
          this.storeNodeProperty('Camera Info', this.getCameraState())
        }
      }

      this.viewHelper.render(this.renderer)
    }
    animate()
  }
}

export default Load3dAnimation
