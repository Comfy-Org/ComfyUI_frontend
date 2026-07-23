import { ZIndex } from '@primeuix/utils/zindex'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

import { usePrimeVueOverlayChildStyle } from '@/composables/usePopoverSizing'

// Base that vRekaZIndex registers Reka dialogs at.
const MODAL_BASE_Z_INDEX = 1700
// The popover's static z-3000 class, which a stacked dialog can climb past.
const POPOVER_Z_INDEX_FLOOR = 3000

describe('usePrimeVueOverlayChildStyle', () => {
  let scope: EffectScope | undefined
  const openDialogs: HTMLElement[] = []

  function openRekaDialog(): number {
    const dialog = document.createElement('div')
    ZIndex.set('modal', dialog, MODAL_BASE_Z_INDEX)
    openDialogs.push(dialog)
    return Number(dialog.style.zIndex)
  }

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
    for (const dialog of openDialogs.splice(0)) ZIndex.clear(dialog)
  })

  it('preserves existing stacking when no dialog is open above it', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    overlayScopeRef.value = document.createElement('div')

    expect(contentStyle.value).toEqual({})
  })

  it('renders above a Reka dialog, which has no PrimeVue mask to find', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()

    let dialogZIndex = openRekaDialog()
    while (dialogZIndex <= POPOVER_Z_INDEX_FLOOR) {
      dialogZIndex = openRekaDialog()
    }

    overlayScopeRef.value = document.createElement('div')

    expect(contentStyle.value).toEqual({ zIndex: dialogZIndex + 1 })
  })

  it('keeps the static floor while stacked dialogs stay below it', () => {
    const { overlayScopeRef, contentStyle } = mountComposable()
    openRekaDialog()

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
