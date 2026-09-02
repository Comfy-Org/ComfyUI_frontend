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
  // A docked surface's own `docked.value ? width : 0` branch never runs once
  // its host is unmounted BEFORE that branch flips (e.g. a parent `v-if`
  // unmounts the whole component in the same flush as closing it) - clear
  // the var directly on teardown so it cannot survive its publisher.
  onScopeDispose(() => {
    document.documentElement.style.setProperty(WORKSPACE_INSET_RIGHT, '0px')
  })
}
