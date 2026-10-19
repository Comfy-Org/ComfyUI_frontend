import { onBeforeUnmount, onMounted } from 'vue'

import { applyDarkPaletteTheme } from '@/utils/colorPaletteTheme'

/**
 * Applies the dark palette to the document root while the calling layout is
 * mounted, so dialogs and toasts teleported to `body` match the dark page.
 */
export function useDocumentDarkTheme(): void {
  let previousStyle = ''
  onMounted(() => {
    const { style } = document.documentElement
    previousStyle = style.cssText
    applyDarkPaletteTheme(style)
  })
  onBeforeUnmount(() => {
    document.documentElement.style.cssText = previousStyle
  })
}
