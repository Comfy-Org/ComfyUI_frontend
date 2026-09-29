import type { SplitterResizeEndEvent } from 'primevue/splitter'
import type { MaybeRefOrGetter, WatchSource } from 'vue'

import { StorageSerializers, unrefElement, useStorage } from '@vueuse/core'
import type { MaybeComputedElementRef } from '@vueuse/core'
import { nextTick, watch } from 'vue'

interface PanelConfig {
  ref: MaybeComputedElementRef
  storageKey: MaybeRefOrGetter<string>
}

interface SizerOptions {
  /**
   * Pin a panel that has no stored width at the width PrimeVue first lays it
   * out at, so it keeps that width when the splitter's container later changes
   * size.
   */
  captureInitialWidth?: boolean
}

function isUsableWidth(width: number | null): width is number {
  return width !== null && Number.isFinite(width) && width > 0
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
    ref: panel.ref,
    width: useStorage<number | null>(panel.storageKey, null, undefined, {
      serializer: StorageSerializers.number
    })
  }))

  function resolveElement(
    ref: MaybeComputedElementRef
  ): HTMLElement | undefined {
    return unrefElement(ref) as HTMLElement | undefined
  }

  function hasSplitterLayout(el: HTMLElement) {
    return el.style.flexBasis.startsWith('calc(')
  }

  function isClamped(el: HTMLElement) {
    const { minWidth, maxWidth } = getComputedStyle(el)
    const containerWidth = el.parentElement?.clientWidth ?? 0
    const max = maxWidth.endsWith('%')
      ? (parseFloat(maxWidth) / 100) * containerWidth
      : parseFloat(maxWidth)
    return el.offsetWidth <= parseFloat(minWidth) || el.offsetWidth >= max - 1
  }

  function measurableWidth(el: HTMLElement) {
    return hasSplitterLayout(el) && el.offsetWidth > 0 ? el.offsetWidth : null
  }

  function pin(el: HTMLElement, width: number) {
    el.style.flexBasis = `${width}px`
    el.style.flexGrow = '0'
    el.style.flexShrink = '0'
  }

  function applyStoredWidths() {
    const panels = storedWidths.flatMap(({ ref, width }) => {
      const el = resolveElement(ref)
      return el ? [{ el, width }] : []
    })
    const initialWidths = panels.map(({ el, width }) =>
      captureInitialWidth && !isUsableWidth(width.value) && !isClamped(el)
        ? measurableWidth(el)
        : null
    )
    panels.forEach(({ el, width }, i) => {
      const initialWidth = initialWidths[i]
      if (initialWidth !== null) width.value = initialWidth
      if (isUsableWidth(width.value)) pin(el, width.value)
    })
  }

  function onResizeEnd(_event: SplitterResizeEndEvent) {
    for (const { ref, width } of storedWidths) {
      const el = resolveElement(ref)
      const resizedWidth = el ? measurableWidth(el) : null
      if (!el || resizedWidth === null) continue
      width.value = resizedWidth
      pin(el, resizedWidth)
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
