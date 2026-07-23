import { ref } from 'vue'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

export function useKeyboard() {
  const store = useMaskEditorStore()
  const keysDown = ref<string[]>([])

  const isKeyDown = (key: string): boolean => {
    return keysDown.value.includes(key)
  }

  const clearKeys = (): void => {
    keysDown.value = []
  }

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!keysDown.value.includes(event.key)) {
      keysDown.value.push(event.key)
    }

    if (event.key === ' ') {
      event.preventDefault()
      const activeElement = document.activeElement as HTMLElement
      if (activeElement && activeElement.blur) {
        activeElement.blur()
      }
    }

    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toUpperCase()
      if ((key === 'Y' && !event.shiftKey) || (key === 'Z' && event.shiftKey)) {
        event.stopPropagation()
        event.preventDefault()
        store.canvasHistory.redo()
      } else if (key === 'Z' && !event.shiftKey) {
        event.stopPropagation()
        event.preventDefault()
        store.canvasHistory.undo()
      }
    }
  }

  const handleKeyUp = (event: KeyboardEvent): void => {
    keysDown.value = keysDown.value.filter((key) => key !== event.key)
  }

  const addListeners = (): void => {
    // Capture phase: the Mask Editor content root carries `@keydown.stop`
    // (MaskEditorContent.vue), so a bubble-phase listener never sees keydowns
    // that originate inside it. Under the Reka dialog the focus trap keeps
    // focus on an in-editor input, so Ctrl+Z/Y (undo/redo) and the space-pan
    // blur were swallowed. Capturing runs this before that stopPropagation.
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearKeys)
  }

  const removeListeners = (): void => {
    document.removeEventListener('keydown', handleKeyDown, true)
    document.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', clearKeys)
  }

  return {
    isKeyDown,
    addListeners,
    removeListeners
  }
}
