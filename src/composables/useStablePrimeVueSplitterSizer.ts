import type { SplitterResizeEndEvent } from 'primevue/splitter'
import type { MaybeRefOrGetter, WatchSource } from 'vue'

import { unrefElement, useStorage } from '@vueuse/core'
import type { MaybeComputedElementRef } from '@vueuse/core'
import { nextTick, toValue, watch } from 'vue'

interface PanelConfig {
  ref: MaybeComputedElementRef
  storageKey: MaybeRefOrGetter<string>
}

type FlexStyle = Pick<
  CSSStyleDeclaration,
  'flexBasis' | 'flexGrow' | 'flexShrink'
>

interface SizerOptions {
  /**
   * Pin a panel that has no stored width at the width it first renders at, so
   * it keeps that width when the splitter's container later changes size.
   */
  captureInitialWidth?: boolean
}

/**
 * Works around PrimeVue Splitter not properly initializing flexBasis
 * when panels are conditionally rendered. Captures pixel widths on
 * resize end and re-applies them as rigid flex values (flex: 0 0 Xpx)
 * when watched sources change (e.g. tab switch, panel toggle).
 *
 * @param panels - array of panel configs with template ref and storage key
 * @param watchSources - reactive sources that trigger re-application
 */
export function useStablePrimeVueSplitterSizer(
  panels: PanelConfig[],
  watchSources: WatchSource[],
  { captureInitialWidth = false }: SizerOptions = {}
) {
  const storedWidths = panels.map((panel) => ({
    ...panel,
    width: useStorage<number | null>(panel.storageKey, null)
  }))
  const appliedKeys = new Map<MaybeComputedElementRef, string>()

  const splitterStyles = new WeakMap<HTMLElement, FlexStyle>()

  function pin(el: HTMLElement, width: number) {
    if (!splitterStyles.has(el)) {
      const { flexBasis, flexGrow, flexShrink } = el.style
      splitterStyles.set(el, { flexBasis, flexGrow, flexShrink })
    }
    el.style.flexBasis = `${width}px`
    el.style.flexGrow = '0'
    el.style.flexShrink = '0'
  }

  function unpin(el: HTMLElement) {
    const style = splitterStyles.get(el)
    if (!style) return
    Object.assign(el.style, style)
    splitterStyles.delete(el)
  }

  function resolveElement(
    ref: MaybeComputedElementRef
  ): HTMLElement | undefined {
    return unrefElement(ref) as HTMLElement | undefined
  }

  function applyStoredWidths() {
    for (const panel of storedWidths) {
      const el = resolveElement(panel.ref)
      if (!el) continue
      const key = toValue(panel.storageKey)
      const appliedKey = appliedKeys.get(panel.ref)
      if (appliedKey !== undefined && appliedKey !== key) unpin(el)
      appliedKeys.set(panel.ref, key)
      const { width } = panel
      if (width.value === null && captureInitialWidth && el.offsetWidth > 0) {
        width.value = el.offsetWidth
      }
      if (width.value !== null) pin(el, width.value)
    }
  }

  function onResizeEnd(_event: SplitterResizeEndEvent) {
    for (const { ref, width } of storedWidths) {
      const el = resolveElement(ref)
      if (el && el.offsetWidth > 0) width.value = el.offsetWidth
    }
  }

  watch(
    watchSources,
    async () => {
      await nextTick()
      applyStoredWidths()
    },
    { immediate: true }
  )

  return { onResizeEnd }
}
