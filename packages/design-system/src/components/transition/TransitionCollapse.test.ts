import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, vShow, withDirectives } from 'vue'

import TransitionCollapse from './TransitionCollapse.vue'

function renderDisclosure() {
  const open = ref(true)
  render(
    defineComponent({
      setup: () => () =>
        h(TransitionCollapse, null, {
          default: () =>
            withDirectives(h('div', { 'data-testid': 'panel' }), [
              [vShow, open.value]
            ])
        })
    }),
    { global: { stubs: { transition: false } } }
  )
  return { open, panel: screen.getByTestId('panel') }
}

function fakeAnimations() {
  const animations: Array<{
    onfinish: (() => void) | null
    reverse: () => void
  }> = []
  const originalAnimate = Element.prototype.animate
  onTestFinished(() => {
    Element.prototype.animate = originalAnimate
  })
  Element.prototype.animate = function () {
    const animation = { onfinish: null, reverse: vi.fn() }
    animations.push(animation)
    return animation as unknown as Animation
  }
  return animations
}

describe('TransitionCollapse', () => {
  it('reverses the running animation when reopened mid-close', async () => {
    const animations = fakeAnimations()
    const { open, panel } = renderDisclosure()

    open.value = false
    await nextTick()
    open.value = true
    await nextTick()

    expect(animations).toHaveLength(1)
    expect(animations[0]?.reverse).toHaveBeenCalledOnce()

    animations[0]?.onfinish?.()
    expect(panel.style.overflow).toBe('')
    expect(panel.style.display).not.toBe('none')
  })

  it('hides the content when a close finishes uninterrupted', async () => {
    const animations = fakeAnimations()
    const { open, panel } = renderDisclosure()

    open.value = false
    await nextTick()
    animations[0]?.onfinish?.()

    expect(panel.style.display).toBe('none')
    expect(panel.style.overflow).toBe('')
  })
})
