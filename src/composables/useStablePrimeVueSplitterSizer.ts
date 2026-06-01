import type { SplitterResizeEndEvent } from 'primevue/splitter'
import type { WatchSource } from 'vue'

import { unrefElement, useStorage } from '@vueuse/core'
import type { MaybeComputedElementRef } from '@vueuse/core'
import { nextTick, watch } from 'vue'

interface PanelConfig {
  ref: MaybeComputedElementRef
  storageKey: string
}

export interface PanelResizeChange {
  storageKey: string
  oldWidth: number | null
  newWidth: number
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
  onResize?: (changes: PanelResizeChange[]) => void
) {
  const storedWidths = panels.map((panel) => ({
    storageKey: panel.storageKey,
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
    const changes: PanelResizeChange[] = []
    for (const { storageKey, ref, width } of storedWidths) {
      const el = resolveElement(ref)
      if (!el) continue
      const oldWidth = width.value
      const newWidth = el.offsetWidth
      width.value = newWidth
      changes.push({ storageKey, oldWidth, newWidth })
    }
    onResize?.(changes)
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
