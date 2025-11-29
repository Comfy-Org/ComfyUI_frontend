import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const interface2Enabled = ref(false)
  const leftSidebarOpen = ref(true)
  const rightSidebarOpen = ref(false)

  function toggleInterface2(): void {
    interface2Enabled.value = !interface2Enabled.value
  }

  function toggleLeftSidebar(): void {
    leftSidebarOpen.value = !leftSidebarOpen.value
  }

  function toggleRightSidebar(): void {
    rightSidebarOpen.value = !rightSidebarOpen.value
  }

  return {
    interface2Enabled,
    leftSidebarOpen,
    rightSidebarOpen,
    toggleInterface2,
    toggleLeftSidebar,
    toggleRightSidebar,
  }
})
