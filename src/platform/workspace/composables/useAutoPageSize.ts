import type { Ref } from 'vue'
import { onScopeDispose, ref, watch } from 'vue'

const FALLBACK_ROW_HEIGHT = 41
const MIN_ROWS = 5

/**
 * Derive a table's rows-per-page from the live height of its scroll container so
 * a taller dialog shows more rows instead of leaving empty space. Row and header
 * heights are read from the rendered table, so it adapts if the design changes.
 */
export function useAutoPageSize(
  containerRef: Ref<HTMLElement | null>,
  min: number = MIN_ROWS
) {
  const pageSize = ref(min)

  function measure() {
    const container = containerRef.value
    if (!container) return
    const rowHeight =
      container.querySelector<HTMLElement>('tbody tr')?.offsetHeight ||
      FALLBACK_ROW_HEIGHT
    const headerHeight =
      container.querySelector<HTMLElement>('thead')?.offsetHeight ?? 0
    const fit = Math.floor((container.clientHeight - headerHeight) / rowHeight)
    pageSize.value = Math.max(min, fit)
  }

  let observer: ResizeObserver | null = null
  watch(
    containerRef,
    (el) => {
      observer?.disconnect()
      if (!el) return
      observer = new ResizeObserver(() => measure())
      observer.observe(el)
    },
    { immediate: true }
  )
  onScopeDispose(() => observer?.disconnect())

  return { pageSize }
}
