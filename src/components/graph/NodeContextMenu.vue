<template>
  <ContextMenu
    ref="contextMenu"
    :model="menuItems"
    class="max-h-[80vh] overflow-y-auto max-w-72"
    @show="onMenuShow"
    @hide="onMenuHide"
  >
    <template #item="{ item, props, hasSubmenu }">
      <a
        v-bind="props.action"
        class="flex items-center gap-2 px-3 py-1.5"
        @click="item.isColorSubmenu ? showColorPopover($event) : undefined"
      >
        <i v-if="item.icon" :class="[item.icon, 'size-4']" />
        <span class="flex-1">{{ item.label }}</span>
        <span
          v-if="item.shortcut"
          class="flex h-3.5 min-w-3.5 items-center justify-center rounded bg-interface-menu-keybind-surface-default px-1 py-0 text-xs"
        >
          {{ item.shortcut }}
        </span>
        <i
          v-if="hasSubmenu || item.isColorSubmenu"
          class="icon-[lucide--chevron-right] size-4 opacity-60"
        />
      </a>
    </template>
  </ContextMenu>

  <!-- Color picker menu (custom with color circles) -->
  <ColorPickerMenu
    v-if="colorOption"
    ref="colorPickerMenu"
    :option="colorOption"
    @submenu-click="handleColorSelect"
  />
</template>

<script setup lang="ts">
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import {
  registerNodeOptionsInstance,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'
import type {
  MenuOption,
  SubMenuOption
} from '@/composables/graph/useMoreOptionsMenu'

import ColorPickerMenu from './selectionToolbox/ColorPickerMenu.vue'

interface ExtendedMenuItem extends MenuItem {
  isColorSubmenu?: boolean
  shortcut?: string
  originalOption?: MenuOption
}

const contextMenu = ref<InstanceType<typeof ContextMenu>>()
const colorPickerMenu = ref<InstanceType<typeof ColorPickerMenu>>()
const isOpen = ref(false)

const { menuOptions, bump } = useMoreOptionsMenu()

// Find color picker option
const colorOption = computed(() =>
  menuOptions.value.find((opt) => opt.isColorPicker)
)

// Check if option is the color picker
function isColorOption(option: MenuOption): boolean {
  return Boolean(option.isColorPicker)
}

// Convert MenuOption to PrimeVue MenuItem
function convertToMenuItem(option: MenuOption): ExtendedMenuItem {
  if (option.type === 'divider') return { separator: true }

  const isColor = isColorOption(option)

  const item: ExtendedMenuItem = {
    label: option.label,
    icon: option.icon,
    disabled: option.disabled,
    shortcut: option.shortcut,
    isColorSubmenu: isColor,
    originalOption: option
  }

  // Native submenus for non-color options
  if (option.hasSubmenu && option.submenu && !isColor) {
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

  // Regular action items
  if (!option.hasSubmenu && option.action) {
    item.command = () => {
      option.action!()
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
  isOpen.value = true
  contextMenu.value?.show(event)
}

// Hide context menu
function hide() {
  contextMenu.value?.hide()
  colorPickerMenu.value?.hide()
}

// Toggle function for compatibility
function toggle(
  event: Event,
  _element?: HTMLElement,
  _clickedFromToolbox?: boolean
) {
  if (isOpen.value) {
    hide()
  } else {
    show(event as MouseEvent)
  }
}

defineExpose({ toggle, hide, isOpen, show })

function showColorPopover(event: MouseEvent) {
  event.stopPropagation()
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  colorPickerMenu.value?.toggle(target)
}

// Handle color selection
function handleColorSelect(subOption: SubMenuOption) {
  subOption.action()
  hide()
}

function onMenuShow() {
  isOpen.value = true
}

function onMenuHide() {
  isOpen.value = false
  colorPickerMenu.value?.hide()
}

onMounted(() => {
  registerNodeOptionsInstance({ toggle, hide, isOpen })
})

onUnmounted(() => {
  registerNodeOptionsInstance(null)
})
</script>
