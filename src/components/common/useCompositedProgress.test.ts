import { usePreferredReducedMotion } from '@vueuse/core'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, effectScope, nextTick, ref, shallowRef } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

import { useCompositedProgress } from './useCompositedProgress'

vi.mock(import('@vueuse/core'), { spy: true })

const reducedMotion = ref(false)
const motionPreference = computed(() =>
  reducedMotion.value ? 'reduce' : 'no-preference'
)

const KEYFRAMES = [{ translate: '-100%' }, { translate: '0%' }]

function showProgress(...args: Parameters<typeof useCompositedProgress>) {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  scope.run(() => useCompositedProgress(...args))
  return scope
}

function scrubbedAnimations(element: HTMLElement) {
  return element
    .getAnimations()
    .filter(({ effect }) => effect instanceof KeyframeEffect)
    .map(({ playState, currentTime }) => ({ playState, currentTime }))
}

function scrubbedTime(element: HTMLElement) {
  return Number(scrubbedAnimations(element)[0].currentTime)
}

describe('useCompositedProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    reducedMotion.value = false
    vi.mocked(usePreferredReducedMotion).mockReturnValue(motionPreference)
  })

  it('holds the progress in one paused animation and leaves the inline style alone', () => {
    const element = document.createElement('div')

    showProgress(element, 0.35, KEYFRAMES)

    expect(scrubbedAnimations(element)).toEqual([
      { playState: 'paused', currentTime: 350 }
    ])
    expect(element.style.translate).toBe('')
  })

  it('eases to new progress in the same animation without touching the style attribute', async () => {
    const element = document.createElement('div')
    const progress = ref(0.2)
    showProgress(element, progress, KEYFRAMES)

    progress.value = 0.8
    await vi.advanceTimersByTimeAsync(100)
    const midway = scrubbedTime(element)
    expect(midway).toBeGreaterThan(200)
    expect(midway).toBeLessThan(800)

    await vi.advanceTimersByTimeAsync(300)
    expect(scrubbedAnimations(element)).toEqual([
      { playState: 'paused', currentTime: 800 }
    ])
    expect(element.getAttribute('style')).toBeNull()
  })

  it('clamps progress to the keyframe range', () => {
    const over = document.createElement('div')
    const under = document.createElement('div')

    showProgress(over, 1.4, KEYFRAMES)
    showProgress(under, -0.2, KEYFRAMES)

    expect(scrubbedTime(over)).toBe(1000)
    expect(scrubbedTime(under)).toBe(0)
  })

  it('shows no progress for a value that is not a number', () => {
    const element = document.createElement('div')

    showProgress(element, NaN, KEYFRAMES)

    expect(scrubbedTime(element)).toBe(0)
  })

  it('follows progress at once under reduced motion', async () => {
    const element = document.createElement('div')
    const progress = ref(0.2)
    showProgress(element, progress, KEYFRAMES)

    reducedMotion.value = true
    progress.value = 0.8
    await nextTick()

    expect(scrubbedTime(element)).toBe(800)
  })

  it.for([
    {
      name: 'OS reduced motion',
      setEnabled: (enabled: boolean) => (reducedMotion.value = enabled)
    },
    {
      name: 'Disable animations',
      setEnabled: (enabled: boolean) => {
        useSettingStore().settingValues['Comfy.Appearance.DisableAnimations'] =
          enabled
      }
    }
  ])(
    'jumps to the target when $name turns on partway through easing',
    async ({ setEnabled }) => {
      const element = document.createElement('div')
      const progress = ref(0.2)
      showProgress(element, progress, KEYFRAMES)

      progress.value = 0.8
      await vi.advanceTimersByTimeAsync(100)
      expect(scrubbedTime(element)).toBeLessThan(800)

      setEnabled(true)
      await nextTick()
      expect(scrubbedTime(element)).toBe(800)

      await vi.advanceTimersByTimeAsync(100)
      expect(scrubbedTime(element)).toBe(800)

      setEnabled(false)
      await nextTick()
      expect(scrubbedTime(element)).toBe(800)
    }
  )

  it('keeps the shown progress when motion returns in the same tick as an update', async () => {
    const element = document.createElement('div')
    const progress = ref(0.2)
    showProgress(element, progress, KEYFRAMES)

    reducedMotion.value = true
    progress.value = 0.8
    await nextTick()
    reducedMotion.value = false
    await nextTick()

    expect(scrubbedTime(element)).toBe(800)
  })

  it('never moves backwards when motion returns before a later update', async () => {
    const element = document.createElement('div')
    const progress = ref(0.2)
    showProgress(element, progress, KEYFRAMES)

    reducedMotion.value = true
    await nextTick()
    progress.value = 0.8
    await nextTick()
    reducedMotion.value = false
    await nextTick()
    expect(scrubbedTime(element)).toBe(800)

    progress.value = 0.9
    await vi.advanceTimersByTimeAsync(100)
    expect(scrubbedTime(element)).toBeGreaterThan(800)
  })

  it('moves the animation to the current element when the target changes', async () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    const target = shallowRef(first)

    showProgress(target, 0.5, KEYFRAMES)
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

    showProgress(target, 0.2, KEYFRAMES)
    target.value = element
    await nextTick()
    expect(scrubbedAnimations(element)).toHaveLength(1)

    target.value = null
    await nextTick()
    expect(scrubbedAnimations(element)).toEqual([])
  })

  it('drops the animation when its scope stops', () => {
    const element = document.createElement('div')
    const scope = showProgress(element, ref(0.5), KEYFRAMES)

    scope.stop()

    expect(scrubbedAnimations(element)).toEqual([])
  })
})
