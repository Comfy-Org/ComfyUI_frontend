import type { WatchSource } from 'vue'
import { nextTick, watch } from 'vue'

const FOCUS_ROW_ATTRIBUTE = 'data-focus-row'

function focusedRow() {
  const row = document.activeElement?.closest<HTMLElement>(
    `[${FOCUS_ROW_ATTRIBUTE}]`
  )
  const menu = row?.parentElement?.closest('[role="menu"]')
  const value = row?.getAttribute(FOCUS_ROW_ATTRIBUTE)
  return row && menu && value ? { row, menu, value } : null
}

/**
 * Puts focus back on the same menu row, matched by its `data-focus-row`,
 * when a change to `source` re-renders the rows.
 */
export function useKeepRowFocus(source: WatchSource) {
  watch(
    source,
    async () => {
      const focused = focusedRow()
      if (!focused) return
      await nextTick()
      if (document.activeElement === focused.row) return
      focused.menu
        .querySelector<HTMLElement>(
          `[${FOCUS_ROW_ATTRIBUTE}="${CSS.escape(focused.value)}"]`
        )
        ?.focus()
    },
    { flush: 'pre' }
  )
}
