import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useSettingStore } from '@/stores/settingStore'

export const useSearchBoxStore = defineStore('searchBox', () => {
  const settingStore = useSettingStore()

  const newSearchBoxEnabled = computed(
    () => settingStore.get('Comfy.NodeSearchBoxImpl') === 'default'
  )

  const visible = ref(false)
  function toggleVisible() {
    visible.value = !visible.value
  }

  return {
    newSearchBoxEnabled,
    toggleVisible,
    visible
  }
})
