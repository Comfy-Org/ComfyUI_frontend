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

  function isPinned(el: HTMLElement) {
    return el.style.flexGrow === '0' && el.style.flexBasis.endsWith('px')
  }

  function pin(el: HTMLElement, width: number) {
    el.style.flexBasis = `${width}px`
    el.style.flexGrow = '0'
    el.style.flexShrink = '0'
  }

  function applyStoredWidths() {
    for (const { ref, width } of storedWidths) {
      const el = resolveElement(ref)
      if (!el) continue
      if (
        !isUsableWidth(width.value) &&
        captureInitialWidth &&
        !isPinned(el) &&
        el.offsetWidth > 0
      ) {
        width.value = el.offsetWidth
      }
      if (isUsableWidth(width.value)) pin(el, width.value)
    }
  }

  function onResizeEnd(_event: SplitterResizeEndEvent) {
    for (const { ref, width } of storedWidths) {
      const el = resolveElement(ref)
      if (!el || isPinned(el) || el.offsetWidth === 0) continue
      width.value = el.offsetWidth
      pin(el, width.value)
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
