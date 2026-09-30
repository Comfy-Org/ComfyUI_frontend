import type {
  SplitterResizeEndEvent,
  SplitterResizeStartEvent
} from 'primevue/splitter'
import type { MaybeRefOrGetter, WatchSource } from 'vue'

import { StorageSerializers, unrefElement, useStorage } from '@vueuse/core'
import type { MaybeComputedElementRef } from '@vueuse/core'
import { nextTick, watch } from 'vue'

interface PanelConfig {
  ref: MaybeComputedElementRef
  storageKey: MaybeRefOrGetter<string>
  /**
   * Pixel width to pin the panel at while nothing is stored. It is not
   * persisted, so a panel the user never resized follows this default.
   */
  defaultWidth?: () => number | null
}

function isUsableWidth(width: number | null | undefined): width is number {
  return width != null && Number.isFinite(width) && width > 0
}

/**
 * Works around PrimeVue Splitter not properly initializing flexBasis
 * when panels are conditionally rendered. Captures pixel widths on
 * resize end and re-applies them as rigid flex values (flex: 0 0 Xpx)
 * when watched sources change (e.g. tab switch, panel toggle).
 *
 * Resize end saves only the panels beside the gutter `onResizeStart` saw.
 *
 * @param panels - array of panel configs with template ref and storage key
 * @param watchSources - reactive sources that trigger re-application
 */
export function useStablePrimeVueSplitterSizer(
  panels: PanelConfig[],
  watchSources: WatchSource[]
) {
  const storedWidths = panels.map((panel) => ({
    ref: panel.ref,
    defaultWidth: panel.defaultWidth,
    width: useStorage<number | null>(panel.storageKey, null, undefined, {
      serializer: StorageSerializers.number
    })
  }))
  let resizedPanels = new Set<Element>()

  function resolveElement(
    ref: MaybeComputedElementRef
  ): HTMLElement | undefined {
    return unrefElement(ref) as HTMLElement | undefined
  }

  function pin(el: HTMLElement, width: number) {
    el.style.flexBasis = `${width}px`
    el.style.flexGrow = '0'
    el.style.flexShrink = '0'
  }

  function applyStoredWidths() {
    for (const { ref, width, defaultWidth } of storedWidths) {
      const el = resolveElement(ref)
      const pinnedWidth = isUsableWidth(width.value)
        ? width.value
        : defaultWidth?.()
      if (el && isUsableWidth(pinnedWidth)) pin(el, pinnedWidth)
    }
  }

  function onResizeStart({ originalEvent }: SplitterResizeStartEvent) {
    const gutter =
      originalEvent.target instanceof Element
        ? originalEvent.target.closest('.p-splitter-gutter')
        : null
    resizedPanels = new Set(
      [gutter?.previousElementSibling, gutter?.nextElementSibling].filter(
        (el): el is Element => el != null
      )
    )
  }

  function onResizeEnd(_event: SplitterResizeEndEvent) {
    for (const { ref, width } of storedWidths) {
      const el = resolveElement(ref)
      if (!el || el.offsetWidth === 0 || !resizedPanels.has(el)) continue
      width.value = el.offsetWidth
      pin(el, el.offsetWidth)
    }
    resizedPanels.clear()
  }

  watch(
    watchSources,
    async () => {
      await nextTick()
      applyStoredWidths()
    },
    { immediate: true }
  )

  return { onResizeStart, onResizeEnd }
}
