import { useMouse } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type NodeSearchBoxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'

function createSyntheticCanvasPointerEvent(
  clientX: number,
  clientY: number
): CanvasPointerEvent {
  const event = new PointerEvent('click', { clientX, clientY })
  return Object.assign(event, {
    layerY: clientY,
    canvasX: clientX,
    canvasY: clientY,
    deltaX: 0,
    deltaY: 0,
    safeOffsetX: clientX,
    safeOffsetY: clientY
  }) as CanvasPointerEvent
}

export const useSearchBoxStore = defineStore('searchBox', () => {
  const settingStore = useSettingStore()
  const { x, y } = useMouse()

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
    const event = createSyntheticCanvasPointerEvent(x.value, y.value)
    popoverRef.value.showSearchBox(event)
  }

  return {
    newSearchBoxEnabled,
    setPopoverRef,
    toggleVisible,
    visible
  }
})
