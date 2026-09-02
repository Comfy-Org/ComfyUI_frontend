import { ref } from 'vue'

export function useKeyboard() {
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
  }

  const handleKeyUp = (event: KeyboardEvent): void => {
    keysDown.value = keysDown.value.filter((key) => key !== event.key)
  }

  const addListeners = (): void => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearKeys)
  }

  const removeListeners = (): void => {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', clearKeys)
  }

  return {
    isKeyDown,
    addListeners,
    removeListeners
  }
}
