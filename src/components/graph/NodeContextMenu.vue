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

  <SubmenuPopover
    v-if="colorOption"
    ref="colorSubmenu"
    key="color-submenu"
    :option="colorOption"
    @submenu-click="handleSubmenuSelect"
  />

  <SubmenuPopover
    v-if="shapeOption"
    ref="shapeSubmenu"
    key="shape-submenu"
    :option="shapeOption"
    @submenu-click="handleSubmenuSelect"
  />
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'

import { useCanvasAnchoredPosition } from '@/composables/graph/useCanvasAnchoredPosition'
import {
  registerNodeOptionsInstance,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'
import type {
  MenuOption,
  SubMenuOption
} from '@/composables/graph/useMoreOptionsMenu'

import SubmenuPopover from './selectionToolbox/SubmenuPopover.vue'

interface ExtendedMenuItem extends MenuItem {
  isColorSubmenu?: boolean
  isShapeSubmenu?: boolean
  shortcut?: string
  originalOption?: MenuOption
}

const contextMenu = ref<InstanceType<typeof ContextMenu>>()
const colorSubmenu = ref<InstanceType<typeof SubmenuPopover>>()
const shapeSubmenu = ref<InstanceType<typeof SubmenuPopover>>()
const isOpen = ref(false)

const { menuOptions, bump } = useMoreOptionsMenu()
const { screenPosition, anchorToEvent } = useCanvasAnchoredPosition(isOpen)

watchEffect(() => {
  if (!isOpen.value) return
  const menuInstance = contextMenu.value as unknown as {
    container?: HTMLElement
  }
  const menuEl = menuInstance?.container
  if (!menuEl) return
  menuEl.style.left = `${screenPosition.value.x}px`
  menuEl.style.top = `${screenPosition.value.y}px`
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
  anchorToEvent(event)
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
    openSubmenuPopover(event, colorSubmenu.value, shapeSubmenu.value)
  } else if (item.isShapeSubmenu) {
    openSubmenuPopover(event, shapeSubmenu.value, colorSubmenu.value)
  }
}

function openSubmenuPopover(
  event: MouseEvent,
  target: InstanceType<typeof SubmenuPopover> | undefined,
  other: InstanceType<typeof SubmenuPopover> | undefined
) {
  if (!target) return
  event.stopPropagation()
  event.preventDefault()
  other?.hide()
  const anchor = Array.from((event.currentTarget as HTMLElement).children).find(
    (el) => el.classList.contains('icon-[lucide--chevron-right]')
  ) as HTMLElement
  target.toggle(event, anchor)
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
