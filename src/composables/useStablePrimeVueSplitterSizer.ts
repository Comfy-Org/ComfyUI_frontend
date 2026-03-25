import type { SplitterResizeEndEvent } from 'primevue/splitter'
import type { WatchSource } from 'vue'

import { unrefElement, useStorage } from '@vueuse/core'
import type { MaybeComputedElementRef } from '@vueuse/core'
import { nextTick, watch } from 'vue'

interface PanelConfig {
  ref: MaybeComputedElementRef
  storageKey: string
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
  watchSources: WatchSource[]
) {
  const storedWidths = panels.map((panel) => ({
    ref: panel.ref,
    width: useStorage<number | null>(panel.storageKey, null)
  }))

  function resolveElement(
    ref: MaybeComputedElementRef
  ): HTMLElement | undefined {
    return unrefElement(ref) as HTMLElement | undefined
  }

  function applyStoredWidths() {
    for (const { ref, width } of storedWidths) {
      const el = resolveElement(ref)
      if (!el || width.value === null) continue
      el.style.flexBasis = `${width.value}px`
      el.style.flexGrow = '0'
      el.style.flexShrink = '0'
    }
  }

  function onResizeEnd(_event: SplitterResizeEndEvent) {
    for (const { ref, width } of storedWidths) {
      const el = resolveElement(ref)
      if (el) width.value = el.offsetWidth
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
