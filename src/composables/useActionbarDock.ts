import { useLocalStorage } from '@vueuse/core'

/**
 * Whether the run bar is docked in the top menu or floating on the canvas.
 *
 * Shared so anything anchored to the run bar — the queue status toast, the
 * inline progress rail — can follow it when the user drags it off the top menu.
 */
export function useActionbarDocked() {
  return useLocalStorage('Comfy.MenuPosition.Docked', true)
}
