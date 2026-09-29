import { getCurrentScope, onScopeDispose, watchEffect } from 'vue'

/**
 * Width consumed by docked surfaces on the right of the workspace.
 *
 * Body-portaled overlays center on the raw viewport, which diverges from the
 * visible workspace once a docked surface takes layout width. They read this
 * variable to offset themselves; docked surfaces declare it.
 */
export const WORKSPACE_INSET_RIGHT = '--workspace-inset-right'

const insetPublishers = new Map<symbol, number>()

function publishCurrentInset(): void {
  const widths = [...insetPublishers.values()]
  if (widths.length === 0) {
    document.documentElement.style.removeProperty(WORKSPACE_INSET_RIGHT)
    return
  }
  const width = Math.max(...widths)
  document.documentElement.style.setProperty(
    WORKSPACE_INSET_RIGHT,
    `${width}px`
  )
}

export function useWorkspaceInsetRight(widthPx: () => number): void {
  if (!getCurrentScope()) return
  const publisher = Symbol()
  watchEffect(() => {
    insetPublishers.set(publisher, widthPx())
    publishCurrentInset()
  })
  onScopeDispose(() => {
    insetPublishers.delete(publisher)
    publishCurrentInset()
  })
}
