import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

import TransitionCollapse from './TransitionCollapse.vue'

type AnimateFn = typeof HTMLElement.prototype.animate

vi.mock('@/scripts/api', () => ({
  api: {
    getSettings: vi.fn(),
    storeSetting: vi.fn(),
    storeSettings: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    ui: {
      settings: {
        dispatchChange: vi.fn()
      }
    }
  }
}))

const TestHost = defineComponent({
  components: { TransitionCollapse },
  props: {
    shown: {
      type: Boolean,
      required: true
    }
  },
  template: `
    <TransitionCollapse>
      <div v-if="shown">Panel content</div>
    </TransitionCollapse>
  `
})

describe('TransitionCollapse', () => {
  const originalAnimate = HTMLElement.prototype.animate
  let animateMock: ReturnType<typeof vi.fn<AnimateFn>>

  beforeEach(() => {
    animateMock = vi.fn<AnimateFn>(() => {
      const animation = { onfinish: null } as unknown as Animation
      queueMicrotask(() => {
        animation.onfinish?.(new Event('finish') as AnimationPlaybackEvent)
      })
      return animation
    })
    HTMLElement.prototype.animate = animateMock
  })

  afterEach(() => {
    HTMLElement.prototype.animate = originalAnimate
  })

  function renderHost(disableAnimations: boolean) {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false
    })
    const settingStore = useSettingStore(pinia)
    settingStore.settingValues['Comfy.Appearance.DisableAnimations'] =
      disableAnimations

    return render(TestHost, {
      props: { shown: false },
      global: {
        plugins: [pinia],
        stubs: {
          Transition: false
        }
      }
    })
  }

  it('uses web animations by default', async () => {
    const { rerender } = renderHost(false)

    await nextTick()
    await rerender({ shown: true })
    await nextTick()

    expect(animateMock).toHaveBeenCalledOnce()
    expect(animateMock.mock.calls[0][1]).toMatchObject({ duration: 150 })
  })

  it('skips web animations when animations are disabled', async () => {
    const { rerender } = renderHost(true)

    await nextTick()
    await rerender({ shown: true })
    await nextTick()

    expect(animateMock).not.toHaveBeenCalled()
  })

  it('skips web animations on leave when animations are disabled', async () => {
    const { rerender } = renderHost(true)

    await nextTick()
    await rerender({ shown: true })
    await nextTick()

    expect(screen.getByText('Panel content')).toBeInTheDocument()

    animateMock.mockClear()
    await rerender({ shown: false })
    await nextTick()

    expect(animateMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument()
  })
})
