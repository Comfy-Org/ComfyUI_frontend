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

    overlayScopeRef.value = appendOverlay(5000)

    expect(contentStyle.value).toEqual({ zIndex: 5001 })
  })

  it('does not drop below the Reka select overlay z-index floor', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = appendOverlay(1200)

    expect(contentStyle.value).toEqual({ zIndex: 3000 })
  })

  it('preserves existing stacking when the dialog z-index is not numeric', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = appendOverlay()

    expect(contentStyle.value).toEqual({})
  })
})

function appendOverlay(zIndex?: number): HTMLElement {
  const overlay = document.createElement('div')
  overlay.dataset.rekaDialogContent = ''
  if (zIndex !== undefined) {
    overlay.style.zIndex = String(zIndex)
  }

  const anchor = document.createElement('div')
  overlay.append(anchor)
  document.body.append(overlay)

  return anchor
}
