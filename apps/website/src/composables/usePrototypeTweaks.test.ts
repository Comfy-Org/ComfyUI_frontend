// @vitest-environment happy-dom
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

type Tweaks = typeof import('./usePrototypeTweaks')

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
    expect(tweaks.scope.value).toBe('v1')
    expect(tweaks.showStatuses.value).toBe(false)
    expect(tweaks.outputCount.value).toBe(1)
    expect(tweaks.outcome.value).toBe('success')
    expect(tweaks.modelState.value).toBe('none')
  })

  it('restores a persisted scope and ignores junk', async () => {
    localStorage.setItem('comfy-workshop-scope', 'v2')
    expect((await mountTweaks()).scope.value).toBe('v2')

    vi.resetModules()
    localStorage.setItem('comfy-workshop-scope', 'v9')
    expect((await mountTweaks()).scope.value).toBe('v1')
  })

  it('persists scope changes and shares state between callers', async () => {
    const first = await mountTweaks()
    const second = await mountTweaks()
    first.scope.value = 'v2'
    await nextTick()
    expect(localStorage.getItem('comfy-workshop-scope')).toBe('v2')
    expect(second.scope.value).toBe('v2')
  })
})
