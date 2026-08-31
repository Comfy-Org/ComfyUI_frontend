import { onScopeDispose, watchEffect } from 'vue'

/**
 * Width consumed by docked surfaces on the right of the workspace.
 *
 * Body-portaled overlays center on the raw viewport, which diverges from the
 * visible workspace once a docked surface takes layout width. They read this
 * variable to offset themselves; docked surfaces declare it.
 */
export const WORKSPACE_INSET_RIGHT = '--workspace-inset-right'

export function useWorkspaceInsetRight(widthPx: () => number): void {
  watchEffect(() => {
    document.documentElement.style.setProperty(
      WORKSPACE_INSET_RIGHT,
      `${widthPx()}px`
    )
  })
  onScopeDispose(() => {
    document.documentElement.style.removeProperty(WORKSPACE_INSET_RIGHT)
  })
}
