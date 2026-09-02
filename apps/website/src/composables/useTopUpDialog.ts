import { readonly, ref } from 'vue'

const isOpen = ref(false)
const insufficient = ref(false)

// Shared across islands: the playground opens the dialog the header renders.
export function useTopUpDialog() {
  return {
    isOpen: readonly(isOpen),
    insufficient: readonly(insufficient),
    open: (options: { insufficient?: boolean } = {}) => {
      insufficient.value = options.insufficient ?? false
      isOpen.value = true
    },
    close: () => {
      isOpen.value = false
    }
  }
}
