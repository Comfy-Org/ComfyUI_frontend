// @vitest-environment happy-dom
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import type * as TweaksModule from './usePrototypeTweaks'

type Tweaks = typeof TweaksModule

async function mountTweaks() {
  const module: Tweaks = await import('./usePrototypeTweaks')
  let api!: ReturnType<Tweaks['usePrototypeTweaks']>
  render(
    defineComponent({
      setup() {
        api = module.usePrototypeTweaks()
        return () => h('div')
      }
    })
  )
  await nextTick()
  return api
}

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

describe('usePrototypeTweaks', () => {
  it('starts on V1 with the invented cases hidden and one output', async () => {
    const tweaks = await mountTweaks()
    expect(tweaks.version.value).toBe('v1')
    expect(tweaks.showStatuses.value).toBe(false)
    expect(tweaks.outputCount.value).toBe(1)
    expect(tweaks.outcome.value).toBe('success')
    expect(tweaks.modelState.value).toBe('none')
  })

  it('restores a persisted version and ignores junk', async () => {
    localStorage.setItem('comfy-workshop-version', 'v1.1')
    expect((await mountTweaks()).version.value).toBe('v1.1')

    vi.resetModules()
    localStorage.setItem('comfy-workshop-version', 'v9')
    expect((await mountTweaks()).version.value).toBe('v1')
  })

  it('persists version changes and shares state between callers', async () => {
    const first = await mountTweaks()
    const second = await mountTweaks()
    first.version.value = 'v2'
    await nextTick()
    expect(localStorage.getItem('comfy-workshop-version')).toBe('v2')
    expect(second.version.value).toBe('v2')
  })
})
