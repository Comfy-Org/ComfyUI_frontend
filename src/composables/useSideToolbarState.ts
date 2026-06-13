import { createSharedComposable } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

// Shared so the layout can react to the toolbar's connected/floating state.
// `isOverflowing` is written by SideToolbar after it measures its content.
export const useSideToolbarState = createSharedComposable(() => {
  const settingStore = useSettingStore()
  const { activeSidebarTab } = storeToRefs(useSidebarTabStore())
  const isOverflowing = ref(false)
  const isConnected = computed(
    () =>
      activeSidebarTab.value !== null ||
      isOverflowing.value ||
      settingStore.get('Comfy.Sidebar.Style') === 'connected'
  )

  return { isConnected, isOverflowing }
})
