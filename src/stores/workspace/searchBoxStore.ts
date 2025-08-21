import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type NodeSearchBoxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import { useSettingStore } from '@/stores/settingStore'

export const useSearchBoxStore = defineStore('searchBox', () => {
  const settingStore = useSettingStore()

  const newSearchBoxEnabled = computed(
    () => settingStore.get('Comfy.NodeSearchBoxImpl') === 'default'
  )

  const popoverRef = shallowRef<InstanceType<
    typeof NodeSearchBoxPopover
  > | null>(null)

  function setPopoverRef(
    popover: InstanceType<typeof NodeSearchBoxPopover> | null
  ) {
    popoverRef.value = popover
  }

  const visible = ref(false)
  function toggleVisible() {
    if (newSearchBoxEnabled.value) {
      visible.value = !visible.value
      return
    }
    if (!popoverRef.value) return
    popoverRef.value.showSearchBox(null)
  }

  return {
    newSearchBoxEnabled,
    setPopoverRef,
    toggleVisible,
    visible
  }
})
