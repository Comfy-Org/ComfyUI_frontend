<template>
  <ContextMenu
    ref="contextMenu"
    :model="menuItems"
    class="max-h-[80vh] overflow-y-auto md:max-h-none md:overflow-y-visible"
    @show="onMenuShow"
    @hide="onMenuHide"
  >
    <template #item="{ item, props, hasSubmenu }">
      <a
        v-bind="props.action"
        class="flex items-center gap-2 px-3 py-1.5"
        @click="onItemClick($event, item)"
      >
        <i v-if="item.icon" :class="[item.icon, 'size-4']" />
        <span class="flex-1">{{ item.label }}</span>
        <span
          v-if="item.shortcut"
          class="flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-interface-menu-keybind-surface-default px-1 py-0 text-xs"
        >
          {{ item.shortcut }}
        </span>
        <i
          v-if="hasSubmenu || item.isColorSubmenu || item.isShapeSubmenu"
          class="icon-[lucide--chevron-right] size-4 opacity-60"
        />
      </a>
    </template>
  </ContextMenu>

  <!-- Color picker menu (custom with color circles) -->
  <ColorPickerMenu
    v-if="colorOption"
    ref="colorPickerMenu"
    key="color-picker-menu"
    :option="colorOption"
    @submenu-click="handleSubmenuSelect"
  />

  <!-- Shape picker menu (body-appended popover so it escapes the menu's
       overflow container; PrimeVue's nested submenu would be clipped when
       the root menu scrolls.) -->
  <ColorPickerMenu
    v-if="shapeOption"
    ref="shapePickerMenu"
    key="shape-picker-menu"
    :option="shapeOption"
    @submenu-click="handleSubmenuSelect"
  />
</template>

<script setup lang="ts">
import { useElementBounding, useEventListener, useRafFn } from '@vueuse/core'
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'

import {
  registerNodeOptionsInstance,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'
import type {
  MenuOption,
  SubMenuOption
} from '@/composables/graph/useMoreOptionsMenu'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import ColorPickerMenu from './selectionToolbox/ColorPickerMenu.vue'

interface ExtendedMenuItem extends MenuItem {
  isColorSubmenu?: boolean
  isShapeSubmenu?: boolean
  shortcut?: string
  originalOption?: MenuOption
}

const contextMenu = ref<InstanceType<typeof ContextMenu>>()
const colorPickerMenu = ref<InstanceType<typeof ColorPickerMenu>>()
const shapePickerMenu = ref<InstanceType<typeof ColorPickerMenu>>()
const isOpen = ref(false)

const { menuOptions, bump } = useMoreOptionsMenu()
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

const colorOption = computed(() =>
  menuOptions.value.find((opt) => opt.isColorPicker)
)

const shapeOption = computed(() =>
  menuOptions.value.find((opt) => opt.isShapePicker)
)

function convertToMenuItem(option: MenuOption): ExtendedMenuItem {
  if (option.type === 'divider') return { separator: true }

  const isColor = Boolean(option.isColorPicker)
  const isShape = Boolean(option.isShapePicker)
  const usesPopover = isColor || isShape

  const item: ExtendedMenuItem = {
    label: option.label,
    icon: option.icon,
    disabled: option.disabled,
    shortcut: option.shortcut,
    isColorSubmenu: isColor,
    isShapeSubmenu: isShape,
    originalOption: option
  }

  // Submenus opened via popover (color, shape) deliberately omit `items` so
  // PrimeVue does not render a nested <ul> inside the scrollable root list,
  // which would be clipped when the menu overflows the viewport (FE-570).
  if (option.hasSubmenu && option.submenu && !usesPopover) {
    item.items = option.submenu.map((sub) => ({
      label: sub.label,
      icon: sub.icon,
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
const menuItems = computed<ExtendedMenuItem[]>(() =>
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

function onItemClick(event: MouseEvent, item: ExtendedMenuItem) {
  if (item.isColorSubmenu) {
    openSubmenuPopover(event, colorPickerMenu.value)
  } else if (item.isShapeSubmenu) {
    openSubmenuPopover(event, shapePickerMenu.value)
  }
}

function openSubmenuPopover(
  event: MouseEvent,
  menu: InstanceType<typeof ColorPickerMenu> | undefined
) {
  if (!menu) return
  event.stopPropagation()
  event.preventDefault()
  const target = Array.from((event.currentTarget as HTMLElement).children).find(
    (el) => el.classList.contains('icon-[lucide--chevron-right]')
  ) as HTMLElement
  menu.toggle(event, target)
}

function handleSubmenuSelect(subOption: SubMenuOption) {
  subOption.action()
  hide()
}

function constrainMenuHeight() {
  const menuInstance = contextMenu.value as unknown as {
    container?: HTMLElement
  }
  const rootList = menuInstance?.container?.querySelector(
    ':scope > ul'
  ) as HTMLElement | null
  if (!rootList) return

  const rect = rootList.getBoundingClientRect()
  const availableHeight = window.innerHeight - rect.top - 8
  if (availableHeight <= 0) return

  // Setting overflow-y to auto/scroll on the root <ul> coerces overflow-x
  // to a non-visible value too (CSS spec), which clips horizontally-opening
  // submenus like Shape. Only apply the constraint when content truly
  // overflows so the common case keeps overflow visible.
  if (rootList.scrollHeight <= availableHeight) return

  rootList.style.maxHeight = `${availableHeight}px`
  rootList.style.overflowY = 'auto'
}

function onMenuShow() {
  isOpen.value = true
  requestAnimationFrame(constrainMenuHeight)
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
