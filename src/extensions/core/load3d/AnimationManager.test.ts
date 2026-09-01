import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AnimationManager } from './AnimationManager'
import type { EventManagerInterface } from './interfaces'

function makeMockEventManager() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    emitEvent: vi.fn()
  } satisfies EventManagerInterface
}

function makeClip(name: string, duration: number): THREE.AnimationClip {
  return new THREE.AnimationClip(name, duration, [])
}

function makeAnimatedModel(
  clips: THREE.AnimationClip[] = []
): THREE.Object3D & { animations: THREE.AnimationClip[] } {
  const obj = new THREE.Object3D() as THREE.Object3D & {
    animations: THREE.AnimationClip[]
  }
  obj.animations = clips
  return obj
}

describe('AnimationManager', () => {
  let events: ReturnType<typeof makeMockEventManager>
  let manager: AnimationManager

  beforeEach(() => {
    vi.clearAllMocks()
    events = makeMockEventManager()
    manager = new AnimationManager(events)
  })

  describe('setupModelAnimations', () => {
    it('creates a mixer and selects the first clip when the model has animations', () => {
      const clips = [makeClip('walk', 2), makeClip('run', 3)]
      const model = makeAnimatedModel(clips)

      manager.setupModelAnimations(model, null)

      expect(manager.currentAnimation).not.toBeNull()
      expect(manager.animationClips).toEqual(clips)
      expect(manager.selectedAnimationIndex).toBe(0)
      expect(manager.animationActions).toHaveLength(1)
    })

    it('falls back to originalModel.animations when the model itself has none', () => {
      const clips = [makeClip('idle', 1.5)]
      const model = makeAnimatedModel([])
      const originalModel = { animations: clips } as unknown as THREE.Object3D

      manager.setupModelAnimations(model, originalModel)

      expect(manager.animationClips).toEqual(clips)
      expect(manager.currentAnimation).not.toBeNull()
    })

    it('emits the localized animation list with default names when clips are unnamed', () => {
      const clips = [makeClip('', 1), makeClip('named', 1)]
      const model = makeAnimatedModel(clips)

      manager.setupModelAnimations(model, null)

      expect(events.emitEvent).toHaveBeenCalledWith('animationListChange', [
        { name: 'Animation 1', index: 0 },
        { name: 'named', index: 1 }
      ])
    })

    it('emits an empty list and leaves no actions when neither source has animations', () => {
      const model = makeAnimatedModel([])

      manager.setupModelAnimations(model, null)

      expect(manager.animationClips).toEqual([])
      expect(manager.animationActions).toEqual([])
      expect(events.emitEvent).toHaveBeenLastCalledWith(
        'animationListChange',
        []
      )
    })

    it('stops previously running actions before loading a new model', () => {
      const firstClips = [makeClip('a', 1)]
      manager.setupModelAnimations(makeAnimatedModel(firstClips), null)
      const firstAction = manager.animationActions[0]
      const stopSpy = vi.spyOn(firstAction, 'stop')

      const secondClips = [makeClip('b', 1)]
      manager.setupModelAnimations(makeAnimatedModel(secondClips), null)

      expect(stopSpy).toHaveBeenCalled()
      expect(manager.animationClips).toEqual(secondClips)
    })
  })

  describe('updateSelectedAnimation', () => {
    it('warns and does nothing when called before any setup', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      manager.updateSelectedAnimation(0)

      expect(warn).toHaveBeenCalled()
      expect(manager.animationActions).toEqual([])
      warn.mockRestore()
    })

    it('warns when the index is out of bounds', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      manager.setupModelAnimations(
        makeAnimatedModel([makeClip('only', 1)]),
        null
      )

      manager.updateSelectedAnimation(5)

      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })

    it('switches to the requested clip and emits an initial progress event', () => {
      const clips = [makeClip('a', 2), makeClip('b', 4)]
      manager.setupModelAnimations(makeAnimatedModel(clips), null)
      events.emitEvent.mockClear()

      manager.updateSelectedAnimation(1)

      expect(manager.selectedAnimationIndex).toBe(1)
      expect(manager.animationActions).toHaveLength(1)
      expect(events.emitEvent).toHaveBeenCalledWith('animationProgressChange', {
        progress: 0,
        currentTime: 0,
        duration: 4
      })
    })

    it('starts the action paused when the manager is not currently playing', () => {
      const clips = [makeClip('a', 2)]
      manager.setupModelAnimations(makeAnimatedModel(clips), null)

      const action = manager.animationActions[0]
      expect(action.paused).toBe(true)
    })

    it('starts the action running when the manager is already playing', () => {
      const clips = [makeClip('a', 2), makeClip('b', 2)]
      manager.setupModelAnimations(makeAnimatedModel(clips), null)
      manager.toggleAnimation(true)

      manager.updateSelectedAnimation(1)

      expect(manager.animationActions[0].paused).toBe(false)
    })
  })

  describe('toggleAnimation', () => {
    it('warns and is a no-op when there is no animation loaded', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      manager.toggleAnimation(true)

      expect(warn).toHaveBeenCalled()
      expect(manager.isAnimationPlaying).toBe(false)
      warn.mockRestore()
    })

    it('flips the playing state when called without an explicit value', () => {
      manager.setupModelAnimations(makeAnimatedModel([makeClip('a', 1)]), null)

      manager.toggleAnimation()
      expect(manager.isAnimationPlaying).toBe(true)
      manager.toggleAnimation()
      expect(manager.isAnimationPlaying).toBe(false)
    })

    it('resets time to zero when starting from the end of the clip', () => {
      manager.setupModelAnimations(makeAnimatedModel([makeClip('a', 2)]), null)
      const action = manager.animationActions[0]
      action.time = action.getClip().duration

      manager.toggleAnimation(true)

      expect(action.time).toBe(0)
      expect(action.paused).toBe(false)
    })
  })

  describe('setAnimationSpeed', () => {
    it('records the speed and propagates it to all current actions', () => {
      manager.setupModelAnimations(makeAnimatedModel([makeClip('a', 1)]), null)
      const action = manager.animationActions[0]
      const setEffectiveTimeScale = vi.spyOn(action, 'setEffectiveTimeScale')

      manager.setAnimationSpeed(2.5)

      expect(manager.animationSpeed).toBe(2.5)
      expect(setEffectiveTimeScale).toHaveBeenCalledWith(2.5)
    })
  })

  describe('setAnimationTime', () => {
    it('clamps the requested time to [0, duration]', () => {
      manager.setupModelAnimations(makeAnimatedModel([makeClip('a', 4)]), null)
      events.emitEvent.mockClear()

      manager.setAnimationTime(-5)
      expect(events.emitEvent).toHaveBeenLastCalledWith(
        'animationProgressChange',
        { progress: 0, currentTime: 0, duration: 4 }
      )

      manager.setAnimationTime(99)
      expect(events.emitEvent).toHaveBeenLastCalledWith(
        'animationProgressChange',
        { progress: 100, currentTime: 4, duration: 4 }
      )
    })

    it('preserves the paused state across the seek', () => {
      manager.setupModelAnimations(makeAnimatedModel([makeClip('a', 4)]), null)
      const action = manager.animationActions[0]
      action.paused = true

      manager.setAnimationTime(2)

      expect(action.paused).toBe(true)
      expect(action.time).toBe(2)
    })

    it('emits a progress event reflecting the seek target', () => {
      manager.setupModelAnimations(makeAnimatedModel([makeClip('a', 4)]), null)
      events.emitEvent.mockClear()

      manager.setAnimationTime(1)

      expect(events.emitEvent).toHaveBeenCalledWith('animationProgressChange', {
        progress: 25,
        currentTime: 1,
        duration: 4
      })
    })

    it('is a no-op when no actions are loaded', () => {
      expect(() => manager.setAnimationTime(1)).not.toThrow()
      expect(events.emitEvent).not.toHaveBeenCalledWith(
        'animationProgressChange',
        expect.anything()
      )
    })
  })

  describe('update', () => {
    it('does not advance the mixer when not playing', () => {
      manager.setupModelAnimations(makeAnimatedModel([makeClip('a', 4)]), null)
      const updateSpy = vi.spyOn(manager.currentAnimation!, 'update')

      manager.update(0.5)

      expect(updateSpy).not.toHaveBeenCalled()
    })

    it('advances the mixer and emits progress while playing', () => {
      manager.setupModelAnimations(makeAnimatedModel([makeClip('a', 4)]), null)
      manager.toggleAnimation(true)
      const updateSpy = vi.spyOn(manager.currentAnimation!, 'update')
      events.emitEvent.mockClear()

      manager.update(0.25)

      expect(updateSpy).toHaveBeenCalledWith(0.25)
      expect(events.emitEvent).toHaveBeenCalledWith(
        'animationProgressChange',
        expect.objectContaining({ duration: 4 })
      )
    })
  })

  describe('getters', () => {
    it('return zero when nothing is loaded', () => {
      expect(manager.getAnimationTime()).toBe(0)
      expect(manager.getAnimationDuration()).toBe(0)
    })

    it('reflect the current action time and clip duration', () => {
      manager.setupModelAnimations(makeAnimatedModel([makeClip('a', 7)]), null)

      expect(manager.getAnimationDuration()).toBe(7)
      manager.animationActions[0].time = 3
      expect(manager.getAnimationTime()).toBe(3)
    })
  })

  describe('dispose', () => {
    it('stops all actions, clears state, and emits an empty list', () => {
      manager.setupModelAnimations(
        makeAnimatedModel([makeClip('a', 1), makeClip('b', 1)]),
        null
      )
      manager.toggleAnimation(true)
      manager.setAnimationSpeed(2)
      manager.selectedAnimationIndex = 1
      const stopSpies = manager.animationActions.map((action) =>
        vi.spyOn(action, 'stop')
      )
      events.emitEvent.mockClear()

      manager.dispose()

      stopSpies.forEach((spy) => expect(spy).toHaveBeenCalled())
      expect(manager.currentAnimation).toBeNull()
      expect(manager.animationActions).toEqual([])
      expect(manager.animationClips).toEqual([])
      expect(manager.selectedAnimationIndex).toBe(0)
      expect(manager.isAnimationPlaying).toBe(false)
      expect(manager.animationSpeed).toBe(1.0)
      expect(events.emitEvent).toHaveBeenCalledWith('animationListChange', [])
    })
  })
})
