import { computed, onMounted, onUnmounted, ref } from 'vue'

const mountedPrompts = ref(0)

/**
 * Registers a mounted Run-slot subscribe prompt for the caller's lifetime.
 * The billing flag alone is not evidence a prompt is on screen — builder
 * mode unmounts the actionbar, Linear mode needs outputs, and the wrapper
 * withholds the prompt for sales-managed and payment-recovery states — so
 * anything yielding to the prompt must key on real presence.
 */
export function registerSubscribeToRunPrompt() {
  onMounted(() => {
    mountedPrompts.value += 1
  })
  onUnmounted(() => {
    mountedPrompts.value = Math.max(0, mountedPrompts.value - 1)
  })
}

/** Whether any Run-slot subscribe prompt is currently on screen. */
export function useSubscribeToRunPromptPresence() {
  return computed(() => mountedPrompts.value > 0)
}
