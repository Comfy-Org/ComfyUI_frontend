import { onBeforeUnmount, onMounted } from 'vue'

const DARK_THEME_CLASS = 'dark-theme'

/**
 * Puts the dark theme on the document root while the calling layout is
 * mounted, so dialogs and toasts teleported to `body` match the dark page.
 */
export function useDocumentDarkTheme(): void {
  let added = false
  onMounted(() => {
    const { classList } = document.documentElement
    added = !classList.contains(DARK_THEME_CLASS)
    classList.add(DARK_THEME_CLASS)
  })
  onBeforeUnmount(() => {
    if (added) document.documentElement.classList.remove(DARK_THEME_CLASS)
  })
}
