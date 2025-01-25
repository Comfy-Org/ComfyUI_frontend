import * as THREE from 'three'

import Load3d from '@/extensions/core/load3d/Load3d'

class Load3dAnimation extends Load3d {
  currentAnimation: THREE.AnimationMixer | null = null
  animationActions: THREE.AnimationAction[] = []
  animationClips: THREE.AnimationClip[] = []
  selectedAnimationIndex: number = 0
  isAnimationPlaying: boolean = false

  animationSpeed: number = 1.0
  playPauseContainer: HTMLDivElement = {} as HTMLDivElement
  animationSelect: HTMLSelectElement = {} as HTMLSelectElement

  constructor(container: Element | HTMLElement) {
    super(container)
    this.createPlayPauseButton(container)
    this.createAnimationList(container)
  }

  createAnimationList(container: Element | HTMLElement) {
    this.animationSelect = document.createElement('select')
    Object.assign(this.animationSelect.style, {
      position: 'absolute',
      top: '3px',
      left: '50%',
      transform: 'translateX(15px)',
      width: '90px',
      height: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      fontSize: '12px',
      padding: '0 8px',
      cursor: 'pointer',
      display: 'none',
      outline: 'none'
    })

    this.animationSelect.addEventListener('mouseenter', () => {
      this.animationSelect.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    })

    this.animationSelect.addEventListener('mouseleave', () => {
      this.animationSelect.style.backgroundColor = 'rgba(0, 0, 0, 0.3)'
    })

    this.animationSelect.addEventListener('change', (event) => {
      const select = event.target as HTMLSelectElement
      this.updateSelectedAnimation(select.selectedIndex)
    })

    container.appendChild(this.animationSelect)
  }

  updateAnimationList() {
    this.animationSelect.innerHTML = ''
    this.animationClips.forEach((clip, index) => {
      const option = document.createElement('option')
      option.value = index.toString()
      option.text = clip.name || `Animation ${index + 1}`
      option.selected = index === this.selectedAnimationIndex
      this.animationSelect.appendChild(option)
    })
  }

  createPlayPauseButton(container: Element | HTMLElement) {
    this.playPauseContainer = document.createElement('div')
    this.playPauseContainer.style.position = 'absolute'
    this.playPauseContainer.style.top = '3px'
    this.playPauseContainer.style.left = '50%'
    this.playPauseContainer.style.transform = 'translateX(-50%)'
    this.playPauseContainer.style.width = '20px'
    this.playPauseContainer.style.height = '20px'
    this.playPauseContainer.style.cursor = 'pointer'
    this.playPauseContainer.style.alignItems = 'center'
    this.playPauseContainer.style.justifyContent = 'center'

    const updateButtonState = () => {
      const icon = this.playPauseContainer.querySelector('svg')
      if (icon) {
        if (this.isAnimationPlaying) {
          icon.innerHTML = `
            <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
          `
          this.playPauseContainer.title = 'Pause Animation'
        } else {
          icon.innerHTML = `
            <path d="M8 5v14l11-7z"/>
          `
          this.playPauseContainer.title = 'Play Animation'
        }
      }
    }

    const playIcon = document.createElement('div')
    playIcon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M8 5v14l11-7z"/>
      </svg>
    `

    this.playPauseContainer.addEventListener('mouseenter', () => {
      this.playPauseContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    })

    this.playPauseContainer.addEventListener('mouseleave', () => {
      this.playPauseContainer.style.backgroundColor = 'transparent'
    })

    this.playPauseContainer.addEventListener('click', (event) => {
      event.stopPropagation()
      this.toggleAnimation()
      updateButtonState()
    })

    this.playPauseContainer.appendChild(playIcon)
    container.appendChild(this.playPauseContainer)

    this.playPauseContainer.style.display = 'none'
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

    if (this.animationClips.length > 0) {
      this.playPauseContainer.style.display = 'block'
    } else {
      this.playPauseContainer.style.display = 'none'
    }

    if (this.animationClips.length > 0) {
      this.playPauseContainer.style.display = 'block'
      this.animationSelect.style.display = 'block'
      this.updateAnimationList()
    } else {
      this.playPauseContainer.style.display = 'none'
      this.animationSelect.style.display = 'none'
    }
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

    this.updateAnimationList()
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

    super.clearModel()

    if (this.animationSelect) {
      this.animationSelect.style.display = 'none'
      this.animationSelect.innerHTML = ''
    }
  }

  getAnimationNames(): string[] {
    return this.animationClips.map((clip, index) => {
      return clip.name || `Animation ${index + 1}`
    })
  }

  toggleAnimation(play?: boolean) {
    if (!this.currentAnimation || this.animationActions.length === 0) {
      console.warn('No animation to toggle')
      return
    }

    this.isAnimationPlaying = play ?? !this.isAnimationPlaying

    const icon = this.playPauseContainer.querySelector('svg')
    if (icon) {
      if (this.isAnimationPlaying) {
        icon.innerHTML = '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>'
        this.playPauseContainer.title = 'Pause Animation'
      } else {
        icon.innerHTML = '<path d="M8 5v14l11-7z"/>'
        this.playPauseContainer.title = 'Play Animation'
      }
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
