/**
 * Composable for programmatically controlling the ComfyUI main menu
 */

import { ref } from 'vue'

const menuButtonRef = ref<HTMLElement | null>(null)

export function useComfyMenu() {
  const registerMenuButton = (el: HTMLElement | null) => {
    menuButtonRef.value = el
  }

  const openMenu = () => {
    menuButtonRef.value?.click()
  }

  return {
    registerMenuButton,
    openMenu
  }
}
