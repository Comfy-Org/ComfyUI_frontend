import { readonly, ref } from 'vue'

/**
 * Collapses the workspace header in the settings dialog once a workspace panel
 * is scrolled, so the panel's controls can take the header's row alongside the
 * close button. Shared module state: the dialog is a singleton, and the panel
 * that owns the scroller is not the component that renders the header.
 */
const isHeaderCollapsed = ref(false)

const COLLAPSE_AFTER_PX = 8

export function useSettingsHeaderCollapse() {
  function handlePanelScroll(event: Event) {
    const scroller = event.target
    if (scroller instanceof HTMLElement) {
      isHeaderCollapsed.value = scroller.scrollTop > COLLAPSE_AFTER_PX
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
