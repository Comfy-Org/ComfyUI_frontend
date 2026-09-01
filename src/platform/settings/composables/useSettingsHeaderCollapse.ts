import { readonly, ref } from 'vue'

/**
 * Collapses the workspace header in the settings dialog once a workspace panel
 * is scrolled, so the panel's controls can take the header's row alongside the
 * close button. Shared module state: the dialog is a singleton, and the panel
 * that owns the scroller is not the component that renders the header.
 */
const isHeaderCollapsed = ref(false)

/**
 * Separate thresholds because collapsing feeds back into its own input:
 * lifting the controls row out of the panel body grows the scroller's viewport
 * and shrinks its overflow, which can clamp scrollTop back down. With a single
 * threshold that clamp re-expands the header, which restores the overflow, and
 * a marginally-scrollable panel flip-flops.
 */
const COLLAPSE_ABOVE_PX = 24
const EXPAND_BELOW_PX = 4

export function useSettingsHeaderCollapse() {
  function handlePanelScroll(event: Event) {
    const scroller = event.target
    if (!(scroller instanceof HTMLElement)) return

    const { scrollTop } = scroller
    if (!isHeaderCollapsed.value && scrollTop > COLLAPSE_ABOVE_PX) {
      isHeaderCollapsed.value = true
    } else if (isHeaderCollapsed.value && scrollTop < EXPAND_BELOW_PX) {
      isHeaderCollapsed.value = false
    }
  }

  function resetHeaderCollapse() {
    isHeaderCollapsed.value = false
  }

  return {
    isHeaderCollapsed: readonly(isHeaderCollapsed),
    handlePanelScroll,
    resetHeaderCollapse
  }
}
