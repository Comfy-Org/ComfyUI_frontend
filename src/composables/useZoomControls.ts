import { computed, ref } from 'vue'

export function useZoomControls() {
  const isPopoverOpen = ref(false)

  const showPopover = () => {
    isPopoverOpen.value = true
  }

  const hidePopover = () => {
    isPopoverOpen.value = false
  }

  const togglePopover = () => {
    isPopoverOpen.value = !isPopoverOpen.value
  }

  const hasActivePopup = computed(() => isPopoverOpen.value)

  return {
    isPopoverOpen,
    showPopover,
    hidePopover,
    togglePopover,
    hasActivePopup
  }
}
