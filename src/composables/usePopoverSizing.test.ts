import { afterEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

import { useOverlayChildStyle } from '@/composables/usePopoverSizing'

describe('useOverlayChildStyle', () => {
  let scope: EffectScope | undefined

  function mountComposable() {
    scope = effectScope()
    let composable: ReturnType<typeof useOverlayChildStyle> | undefined

    scope.run(() => {
      composable = useOverlayChildStyle()
    })

    if (!composable) {
      throw new Error('Failed to mount composable')
    }

    return composable
  }

  afterEach(() => {
    scope?.stop()
    scope = undefined
  })

  it('preserves existing stacking when there is no parent overlay', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = document.createElement('div')

    expect(contentStyle.value).toEqual({})
  })

  it('renders above the closest Reka dialog', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = appendOverlay('reka-dialog', 5000)

    expect(contentStyle.value).toEqual({ zIndex: 5001 })
  })

  it('renders above the closest PrimeVue overlay mask', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = appendOverlay('prime-overlay', 4200)

    expect(contentStyle.value).toEqual({ zIndex: 4201 })
  })

  it('does not drop below the Reka select overlay z-index floor', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = appendOverlay('reka-dialog', 1200)

    expect(contentStyle.value).toEqual({ zIndex: 3000 })
  })

  it('preserves existing stacking when the PrimeVue overlay z-index is not numeric', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = appendOverlay('reka-dialog')

    expect(contentStyle.value).toEqual({})
  })
})

function appendOverlay(
  kind: 'reka-dialog' | 'prime-overlay',
  zIndex?: number
): HTMLElement {
  const overlay = document.createElement('div')
  if (kind === 'reka-dialog') overlay.dataset.rekaDialogContent = ''
  else overlay.className = 'p-overlay-mask'
  if (zIndex !== undefined) {
    overlay.style.zIndex = String(zIndex)
  }

  const anchor = document.createElement('div')
  overlay.append(anchor)
  document.body.append(overlay)

  return anchor
}
