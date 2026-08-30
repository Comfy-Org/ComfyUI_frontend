<template>
  <ContextMenu
    ref="contextMenu"
    :model="menuItems"
    class="max-h-[calc(100vh-1rem)] overflow-y-auto"
    @show="onMenuShow"
    @hide="onMenuHide"
  >
    <template #item="{ item, props, hasSubmenu }">
      <a v-bind="props.action" class="flex items-center gap-2 px-3 py-1.5">
        <span
          v-if="item.color"
          class="size-5 rounded-full border border-border-default"
          :style="{ backgroundColor: item.color }"
        />
        <i v-else-if="item.icon" :class="[item.icon, 'size-4']" />
        <i
          v-else-if="item.checked"
          class="icon-[lucide--check] size-4 shrink-0"
        />
        <span v-else-if="item.isShapeSubmenuItem" class="w-4 shrink-0" />
        <span class="flex-1">{{ item.label }}</span>
        <span
          v-if="item.shortcut"
          class="flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-interface-menu-keybind-surface-default px-1 py-0 text-xs"
        >
          {{ item.shortcut }}
        </span>
        <i
          v-if="hasSubmenu"
          class="icon-[lucide--chevron-right] size-4 opacity-60"
        />
      </a>
    </template>
  </ContextMenu>
</template>

<script setup lang="ts">
import { useElementBounding, useEventListener, useRafFn } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'

import ContextMenu from '@/components/ui/menu/ContextMenu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import {
  registerNodeOptionsInstance,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'
import type { MenuOption } from '@/composables/graph/useMoreOptionsMenu'
import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

const contextMenu = ref<InstanceType<typeof ContextMenu>>()
const isOpen = ref(false)

const { menuOptions, bump } = useMoreOptionsMenu()
const { getCurrentShape } = useNodeCustomization()
const canvasStore = useCanvasStore()

// World position (canvas coordinates) where menu was opened
const worldPosition = ref({ x: 0, y: 0 })

// Get canvas bounding rect reactively
const lgCanvas = canvasStore.getCanvas()
const { left: canvasLeft, top: canvasTop } = useElementBounding(lgCanvas.canvas)

// Track last canvas transform to detect actual changes
let lastScale = 0
let lastOffsetX = 0
let lastOffsetY = 0

// Update menu position based on canvas transform
const updateMenuPosition = () => {
  if (!isOpen.value) return

  const menuInstance = contextMenu.value as unknown as {
    container?: HTMLElement
  }
  const menuEl = menuInstance?.container
  if (!menuEl) return

  const { scale, offset } = lgCanvas.ds

  // Only update if canvas transform actually changed
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

  // Convert world position to screen position
  const screenX = (worldPosition.value.x + offset[0]) * scale + canvasLeft.value
  const screenY = (worldPosition.value.y + offset[1]) * scale + canvasTop.value

  // Update menu position
  menuEl.style.left = `${screenX}px`
  menuEl.style.top = `${screenY}px`
}

// Sync with canvas transform using requestAnimationFrame
const { resume: startSync, pause: stopSync } = useRafFn(updateMenuPosition, {
  immediate: false
})

// Start/stop syncing based on menu visibility
watchEffect(() => {
  if (isOpen.value) {
    startSync()
  } else {
    stopSync()
  }
})

// Close on touch outside to handle mobile devices where click might be swallowed
useEventListener(
  window,
  'touchstart',
  (event: TouchEvent) => {
    if (!isOpen.value || !contextMenu.value) return

    const target = event.target as Node
    const contextMenuInstance = contextMenu.value as unknown as {
      container?: HTMLElement
      $el?: HTMLElement
    }
    const menuEl = contextMenuInstance.container || contextMenuInstance.$el

    if (menuEl && !menuEl.contains(target)) {
      hide()
    }
  },
  { passive: true }
)

function convertToMenuItem(option: MenuOption): MenuItem {
  if (option.type === 'divider') return { separator: true }

  const item: MenuItem = {
    label: option.label,
    icon: option.icon,
    disabled: option.disabled,
    shortcut: option.shortcut
  }

  if (option.hasSubmenu && option.submenu) {
    item.items = option.submenu.map((sub) => ({
      label: sub.label,
      icon: sub.icon,
      color: sub.color,
      checked:
        Boolean(option.isShapePicker) &&
        getCurrentShape()?.localizedName === sub.label,
      isShapeSubmenuItem: Boolean(option.isShapePicker),
      disabled: sub.disabled,
      command: () => {
        sub.action()
        hide()
      }
    }))
  }

  if (!option.hasSubmenu && option.action) {
    item.command = () => {
      option.action?.()
      hide()
    }
  }

  return item
}

// Build menu items
const menuItems = computed<MenuItem[]>(() =>
  menuOptions.value.map(convertToMenuItem)
)

// Show context menu
function show(event: MouseEvent) {
  bump()

  // Convert screen position to world coordinates
  // Screen position relative to canvas = event position - canvas offset
  const screenX = event.clientX - canvasLeft.value
  const screenY = event.clientY - canvasTop.value

  // Convert to world coordinates using canvas transform
  const { scale, offset } = lgCanvas.ds
  worldPosition.value = {
    x: screenX / scale - offset[0],
    y: screenY / scale - offset[1]
  }

  // Initialize last* values to current transform to prevent updateMenuPosition
  // from overwriting PrimeVue's flip-adjusted position on the first RAF tick
  lastScale = scale
  lastOffsetX = offset[0]
  lastOffsetY = offset[1]

  isOpen.value = true
  contextMenu.value?.show(event)
}

// Hide context menu
function hide() {
  contextMenu.value?.hide()
}

function toggle(event: Event) {
  if (isOpen.value) {
    hide()
  } else {
    show(event as MouseEvent)
  }
}

defineExpose({ toggle, hide, isOpen, show })

function onMenuShow() {
  isOpen.value = true
}

function onMenuHide() {
  isOpen.value = false
}

onMounted(() => {
  registerNodeOptionsInstance({ toggle, show, hide, isOpen })
})

onUnmounted(() => {
  registerNodeOptionsInstance(null)
})
</script>
