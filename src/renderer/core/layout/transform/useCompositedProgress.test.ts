import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref, shallowRef } from 'vue'

import { useCompositedProgress } from './useCompositedProgress'

const KEYFRAMES = [{ translate: '-100%' }, { translate: '0%' }]

function scrubbedAnimations(element: HTMLElement) {
  return element
    .getAnimations()
    .filter(({ effect }) => effect instanceof KeyframeEffect)
    .map(({ playState, currentTime }) => ({ playState, currentTime }))
}

describe('useCompositedProgress', () => {
  it('holds the progress in one paused animation and leaves the inline style alone', () => {
    const element = document.createElement('div')

    useCompositedProgress(element, 0.35, KEYFRAMES)

    expect(scrubbedAnimations(element)).toEqual([
      { playState: 'paused', currentTime: 350 }
    ])
    expect(element.style.translate).toBe('')
  })

  it('clamps progress to the keyframe range', () => {
    const over = document.createElement('div')
    const under = document.createElement('div')

    useCompositedProgress(over, 1.4, KEYFRAMES)
    useCompositedProgress(under, -0.2, KEYFRAMES)

    expect(scrubbedAnimations(over)[0].currentTime).toBe(1000)
    expect(scrubbedAnimations(under)[0].currentTime).toBe(0)
  })

  it('moves the animation to the current element when the target changes', async () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    const target = shallowRef(first)

    useCompositedProgress(target, 0.5, KEYFRAMES)
    target.value = second
    await nextTick()

    expect(scrubbedAnimations(first)).toEqual([])
    expect(scrubbedAnimations(second)).toEqual([
      { playState: 'paused', currentTime: 500 }
    ])
  })

  it('waits for the element and drops the animation when it goes away', async () => {
    const element = document.createElement('div')
    const target = shallowRef<HTMLElement | null>(null)

    useCompositedProgress(target, 0.2, KEYFRAMES)
    target.value = element
    await nextTick()
    expect(scrubbedAnimations(element)).toHaveLength(1)

    target.value = null
    await nextTick()
    expect(scrubbedAnimations(element)).toEqual([])
  })

  it('drops the animation when its scope stops', () => {
    const element = document.createElement('div')
    const scope = effectScope()
    scope.run(() => useCompositedProgress(element, ref(0.5), KEYFRAMES))

    scope.stop()

    expect(scrubbedAnimations(element)).toEqual([])
  })
})
