import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type InterfaceVersion = 'v1' | 'v2'

export const useUiStore = defineStore('ui', () => {
  // Interface version: v1 = legacy, v2 = experimental
  const interfaceVersion = ref<InterfaceVersion>('v2')
  const leftSidebarOpen = ref(true)
  const rightSidebarOpen = ref(false)

  // Computed for backwards compatibility
  const interface2Enabled = computed(() => interfaceVersion.value === 'v2')

  function setInterfaceVersion(version: InterfaceVersion): void {
    interfaceVersion.value = version
  }

  function toggleInterfaceVersion(): void {
    interfaceVersion.value = interfaceVersion.value === 'v1' ? 'v2' : 'v1'
  }

  function toggleLeftSidebar(): void {
    leftSidebarOpen.value = !leftSidebarOpen.value
  }

  function toggleRightSidebar(): void {
    rightSidebarOpen.value = !rightSidebarOpen.value
  }

  return {
    interfaceVersion,
    interface2Enabled,
    leftSidebarOpen,
    rightSidebarOpen,
    setInterfaceVersion,
    toggleInterfaceVersion,
    toggleLeftSidebar,
    toggleRightSidebar,
  }
})
