import { useMouse } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type NodeSearchBoxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import { useSettingStore } from '@/platform/settings/settingStore'

export const useSearchBoxStore = defineStore('searchBox', () => {
  const settingStore = useSettingStore()
  const { x, y } = useMouse()

  const useSearchBoxV2 = computed(
    () => settingStore.get('Comfy.NodeSearchBoxImpl') === 'default'
  )

  const newSearchBoxEnabled = computed(
    () => settingStore.get('Comfy.NodeSearchBoxImpl') !== 'litegraph (legacy)'
  )

  type SearchBoxPopover = Pick<
    InstanceType<typeof NodeSearchBoxPopover>,
    'showSearchBox'
  >
  const popoverRef = shallowRef<SearchBoxPopover | null>(null)

  function setPopoverRef(popover: SearchBoxPopover | null) {
    popoverRef.value = popover
  }

  const visible = ref(false)
  function toggleVisible() {
    if (newSearchBoxEnabled.value) {
      visible.value = !visible.value
      return
    }
    if (!popoverRef.value) return
    popoverRef.value.showSearchBox(
      Object.assign(
        new PointerEvent('click', { clientX: x.value, clientY: y.value }),
        {
          canvasX: x.value,
          canvasY: y.value,
          deltaX: 0,
          deltaY: 0,
          safeOffsetX: x.value,
          safeOffsetY: y.value
        }
      )
    )
  }

  return {
    useSearchBoxV2,
    newSearchBoxEnabled,
    setPopoverRef,
    toggleVisible,
    visible
  }
})
