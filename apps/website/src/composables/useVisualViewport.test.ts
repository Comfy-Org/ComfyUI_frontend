// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { useVisualViewport } from './useVisualViewport'

const own = Object.getOwnPropertyDescriptor(window, 'visualViewport')

function withViewport(viewport: unknown) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport
  })
}

afterEach(() => {
  if (own) Object.defineProperty(window, 'visualViewport', own)
  else withViewport(undefined)
})

describe('useVisualViewport', () => {
  it('reads nothing where the browser offers no visual viewport', () => {
    withViewport(undefined)
    const scope = effectScope()
    const seen = scope.run(() => useVisualViewport())!
    expect(seen.height.value).toBeNull()
    scope.stop()
  })

  it('follows the screen as the keyboard takes it and gives it back', async () => {
    const viewport = Object.assign(new EventTarget(), {
      height: 851,
      offsetTop: 0
    })
    withViewport(viewport)

    const scope = effectScope()
    const seen = scope.run(() => useVisualViewport())!
    expect(seen.height.value).toBe(851)

    viewport.height = 471
    viewport.offsetTop = 12
    viewport.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(seen.height.value).toBe(471)
    expect(seen.offsetTop.value).toBe(12)

    viewport.height = 851
    viewport.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(seen.height.value).toBe(851)

    scope.stop()
    viewport.height = 100
    viewport.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(seen.height.value).toBe(851)
  })
})
