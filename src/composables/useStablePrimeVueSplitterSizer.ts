import type {
  SplitterResizeEndEvent,
  SplitterResizeStartEvent
} from 'primevue/splitter'
import type { MaybeRefOrGetter, WatchSource } from 'vue'

import { StorageSerializers, unrefElement, useStorage } from '@vueuse/core'
import type { MaybeComputedElementRef } from '@vueuse/core'
import { nextTick, toValue, watch } from 'vue'

interface PanelConfig {
  ref: MaybeComputedElementRef
  storageKey: MaybeRefOrGetter<string>
  /**
   * Pixel width to store and pin the panel at the first time it renders with
   * nothing stored.
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
    ...panel,
    width: useStorage<number | null>(panel.storageKey, null, undefined, {
      serializer: StorageSerializers.number
    })
  }))
  let resizeStart = new Map<Element, { width: number; storageKey: string }>()

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
      if (!el) continue
      if (!isUsableWidth(width.value)) {
        const initialWidth = defaultWidth?.()
        if (isUsableWidth(initialWidth)) width.value = initialWidth
      }
      if (isUsableWidth(width.value)) pin(el, width.value)
    }
  }

  function onResizeStart({ originalEvent }: SplitterResizeStartEvent) {
    const gutter =
      originalEvent.target instanceof Element
        ? originalEvent.target.closest('.p-splitter-gutter')
        : null
    const besideGutter = [
      gutter?.previousElementSibling,
      gutter?.nextElementSibling
    ]
    resizeStart = new Map(
      storedWidths.flatMap(({ ref, storageKey }) => {
        const el = resolveElement(ref)
        if (!el || !besideGutter.includes(el)) return []
        const start = { width: el.offsetWidth, storageKey: toValue(storageKey) }
        return [[el, start] as const]
      })
    )
  }

  function onResizeEnd(_event: SplitterResizeEndEvent) {
    for (const { ref, width, storageKey } of storedWidths) {
      const el = resolveElement(ref)
      const start = el && resizeStart.get(el)
      if (!el || !start) continue
      const resized =
        el.offsetWidth > 0 &&
        el.offsetWidth !== start.width &&
        toValue(storageKey) === start.storageKey
      if (resized) width.value = el.offsetWidth
      if (isUsableWidth(width.value)) pin(el, width.value)
    }
    resizeStart.clear()
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
