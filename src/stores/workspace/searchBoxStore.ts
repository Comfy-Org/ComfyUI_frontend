import { useMouse } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type NodeSearchBoxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

export const useSearchBoxStore = defineStore('searchBox', () => {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()
  const { x, y } = useMouse({ type: 'client' })

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
    const event = new PointerEvent('click', {
      clientX: x.value,
      clientY: y.value
    })
    const canvas: LGraphCanvas = canvasStore.getCanvas()
    canvas.adjustMouseEvent(event)
    popoverRef.value.showSearchBox(event)
  }

  function openAtEvent(event: CanvasPointerEvent) {
    if (popoverRef.value) {
      popoverRef.value.showSearchBox(event)
      return
    }
    if (newSearchBoxEnabled.value) {
      visible.value = true
    }
  }

  return {
    useSearchBoxV2,
    newSearchBoxEnabled,
    setPopoverRef,
    toggleVisible,
    openAtEvent,
    visible
  }
})
