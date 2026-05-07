import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

import { usePrimeVueOverlayChildStyle } from '@/composables/usePopoverSizing'

describe('usePrimeVueOverlayChildStyle', () => {
  let scope: EffectScope | undefined

  function mountComposable() {
    scope = effectScope()
    let composable: ReturnType<typeof usePrimeVueOverlayChildStyle> | undefined

    scope.run(() => {
      composable = usePrimeVueOverlayChildStyle()
    })

    if (!composable) {
      throw new Error('Failed to mount composable')
    }

    return composable
  }

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    scope?.stop()
    scope = undefined
    document.body.innerHTML = ''
  })

  it('preserves existing stacking when there is no PrimeVue parent overlay', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = document.createElement('div')

    expect(contentStyle.value).toEqual({})
  })

  it('renders above the closest PrimeVue dialog mask', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = appendPrimeVueOverlay('p-dialog-mask', 5000)

    expect(contentStyle.value).toEqual({ zIndex: 5001 })
  })

  it('renders above the closest PrimeVue overlay mask', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = appendPrimeVueOverlay('p-overlay-mask', 4200)

    expect(contentStyle.value).toEqual({ zIndex: 4201 })
  })

  it('does not drop below the Reka select overlay z-index floor', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = appendPrimeVueOverlay('p-dialog-mask', 1200)

    expect(contentStyle.value).toEqual({ zIndex: 3000 })
  })

  it('preserves existing stacking when the PrimeVue overlay z-index is not numeric', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = appendPrimeVueOverlay('p-dialog-mask')

    expect(contentStyle.value).toEqual({})
  })
})

function appendPrimeVueOverlay(
  className: string,
  zIndex?: number
): HTMLElement {
  const overlay = document.createElement('div')
  overlay.className = className
  if (zIndex !== undefined) {
    overlay.style.zIndex = String(zIndex)
  }

  const anchor = document.createElement('div')
  overlay.append(anchor)
  document.body.append(overlay)

  return anchor
}
