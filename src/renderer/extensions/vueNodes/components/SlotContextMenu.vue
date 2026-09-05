<template>
  <ContextMenu
    ref="contextMenu"
    :model="menuItems"
    class="max-h-[80vh] overflow-y-auto"
    @show="onMenuShow"
    @hide="onMenuHide"
  >
    <template #item="{ item, props: itemProps }">
      <a v-bind="itemProps.action" class="flex items-center gap-2 px-3 py-1.5">
        <span class="flex-1">{{ item.label }}</span>
      </a>
    </template>
  </ContextMenu>
</template>

<script setup lang="ts">
import { useElementBounding, useRafFn } from '@vueuse/core'
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  connectSlots,
  findCompatibleTargets,
  registerSlotMenuInstance
} from '@/renderer/extensions/vueNodes/composables/useSlotContextMenu'
import type { SlotMenuContext } from '@/renderer/extensions/vueNodes/composables/useSlotContextMenu'

const contextMenu = ref<InstanceType<typeof ContextMenu>>()
const isOpen = ref(false)
const activeContext = ref<SlotMenuContext | null>(null)

const canvasStore = useCanvasStore()
const lgCanvas = canvasStore.getCanvas()
const { left: canvasLeft, top: canvasTop } = useElementBounding(lgCanvas.canvas)

const worldPosition = ref({ x: 0, y: 0 })
let lastScale = 0
let lastOffsetX = 0
let lastOffsetY = 0

function updateMenuPosition() {
  if (!isOpen.value) return

  const menuInstance = contextMenu.value as unknown as {
    container?: HTMLElement
  }
  const menuEl = menuInstance?.container
  if (!menuEl) return

  const { scale, offset } = lgCanvas.ds

  if (
    scale === lastScale &&
    offset[0] === lastOffsetX &&
    offset[1] === lastOffsetY
  ) {
    return
  }

  lastScale = scale
  lastOffsetX = offset[0]
  lastOffsetY = offset[1]

  const screenX = (worldPosition.value.x + offset[0]) * scale + canvasLeft.value
  const screenY = (worldPosition.value.y + offset[1]) * scale + canvasTop.value

  menuEl.style.left = `${screenX}px`
  menuEl.style.top = `${screenY}px`
}

const { resume: startSync, pause: stopSync } = useRafFn(updateMenuPosition, {
  immediate: false
})

watchEffect(() => {
  if (isOpen.value) {
    startSync()
  } else {
    stopSync()
  }
})

const menuItems = computed<MenuItem[]>(() => {
  const ctx = activeContext.value
  if (!ctx) return []

  const targets = findCompatibleTargets(ctx)
  if (targets.length === 0) {
    return [{ label: 'No compatible nodes', disabled: true }]
  }

  return [
    { label: 'Connect to...', disabled: true },
    { separator: true },
    ...targets.map((target) => ({
      label: `${target.slotInfo.name} @ ${target.node.title || target.node.type}`,
      command: () => {
        connectSlots(ctx, target)
        hide()
      }
    }))
  ]
})

function show(event: MouseEvent, context: SlotMenuContext) {
  activeContext.value = context

  const screenX = event.clientX - canvasLeft.value
  const screenY = event.clientY - canvasTop.value
  const { scale, offset } = lgCanvas.ds
  worldPosition.value = {
    x: screenX / scale - offset[0],
    y: screenY / scale - offset[1]
  }

  lastScale = scale
  lastOffsetX = offset[0]
  lastOffsetY = offset[1]

  isOpen.value = true
  contextMenu.value?.show(event)
}

function hide() {
  contextMenu.value?.hide()
}

function onMenuShow() {
  isOpen.value = true
}

function onMenuHide() {
  isOpen.value = false
  activeContext.value = null
}

defineExpose({ show, hide, isOpen })

onMounted(() => {
  registerSlotMenuInstance({ show, hide, isOpen })
})

onUnmounted(() => {
  registerSlotMenuInstance(null)
})
</script>
