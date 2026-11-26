import { onBeforeUnmount, onMounted } from 'vue'

import { DEFAULT_DARK_THEME_PRESET } from '@comfyorg/theme-core/builtInThemePresets'
import { resolveTheme } from '@comfyorg/theme-core/resolveTheme'
import { applyTheme } from '@/platform/theme/applyTheme'

export function useDocumentDarkTheme(): void {
  let previousStyle = ''
  onMounted(() => {
    const { style } = document.documentElement
    previousStyle = style.cssText
    applyTheme(resolveTheme(DEFAULT_DARK_THEME_PRESET), { style })
  })
  onBeforeUnmount(() => {
    document.documentElement.style.cssText = previousStyle
  })
}
