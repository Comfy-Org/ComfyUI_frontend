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

interface SizerOptions {
  /**
   * Width (px) the pinned panels must leave for the rest of the splitter. When
   * the rendered panels do not fit beside it, each keeps its CSS min-width and
   * shares what is left in proportion to how far its pinned width exceeds it.
   */
  reservedWidth?: number
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
  watchSources: WatchSource[],
  { reservedWidth }: SizerOptions = {}
) {
  const storedWidths = panels.map((panel) => ({
    ...panel,
    width: useStorage<number | null>(panel.storageKey, null, undefined, {
      serializer: StorageSerializers.number
    })
  }))
  let resizeStart = new Map<Element, { width: number; storageKey: string }>()
  let resizeGutter: Element | null = null

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

  function pinnedWidth(el: HTMLElement) {
    const basis = parseFloat(el.style.flexBasis)
    return el.style.flexBasis.endsWith('px') && Number.isFinite(basis)
      ? basis
      : el.offsetWidth
  }

  function applyWidthBudget() {
    if (reservedWidth === undefined) return
    const rendered = storedWidths.flatMap(({ ref }) => {
      const el = resolveElement(ref)
      return el && el.offsetWidth > 0 ? [el] : []
    })
    const minWidths = rendered.map(
      (el) => parseFloat(getComputedStyle(el).minWidth) || 0
    )
    const excessWidths = rendered.map((el, i) =>
      Math.max(0, pinnedWidth(el) - minWidths[i])
    )
    const totalMinWidth = minWidths.reduce((sum, width) => sum + width, 0)
    const totalExcessWidth = excessWidths.reduce((sum, width) => sum + width, 0)
    rendered.forEach((el, i) => {
      const share = (
        totalExcessWidth > 0 ? excessWidths[i] / totalExcessWidth : 0
      ).toFixed(4)
      el.style.maxWidth = `calc(${minWidths[i]}px + (100% - ${reservedWidth + totalMinWidth}px) * ${share})`
    })
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
    applyWidthBudget()
  }

  function onResizeStart({ originalEvent }: SplitterResizeStartEvent) {
    const gutter =
      originalEvent.target instanceof Element
        ? originalEvent.target.closest('.p-splitter-gutter')
        : null
    // Keyboard resizing emits resizestart on every key repeat; keep the widths
    // from the first one so resize end compares against the gesture's start.
    if (gutter !== null && gutter === resizeGutter) return
    resizeGutter = gutter
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
    resizeGutter = null
    applyWidthBudget()
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
