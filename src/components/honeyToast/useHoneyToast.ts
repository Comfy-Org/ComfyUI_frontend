import { ref } from 'vue'

import type { Ref } from 'vue'

export interface UseHoneyToastOptions {
  defaultExpanded?: boolean
}

export interface UseHoneyToastReturn {
  isExpanded: Ref<boolean>
  toggle: () => void
  expand: () => void
  collapse: () => void
}

export function useHoneyToast(
  options: UseHoneyToastOptions = {}
): UseHoneyToastReturn {
  const { defaultExpanded = false } = options

  const isExpanded = ref(defaultExpanded)

  function toggle() {
    isExpanded.value = !isExpanded.value
  }

  function expand() {
    isExpanded.value = true
  }

  function collapse() {
    isExpanded.value = false
  }

  return {
    isExpanded,
    toggle,
    expand,
    collapse
  }
}
