import type { Ref } from 'vue'
import { ref } from 'vue'

/**
 * Singleton state for the error panel survey popover visibility.
 * Kept at module scope so popover visibility survives the lifecycle of
 * individual host components (e.g. the error tab being destroyed when no
 * errors remain). Together with the popover component keeping its
 * Teleport mounted after the first open, this is what preserves the
 * Typeform iframe across workflow switches.
 */
const isPopoverOpen = ref(false)

export function useErrorSurveyPopoverState(): {
  isPopoverOpen: Ref<boolean>
  open: () => void
} {
  function open() {
    isPopoverOpen.value = true
  }

  return {
    isPopoverOpen,
    open
  }
}
