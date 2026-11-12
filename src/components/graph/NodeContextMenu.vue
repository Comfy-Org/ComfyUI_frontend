<template>
  <Menu
    v-bind="menuProps"
    :items="menuItems"
    :reference="menuReference"
    update-position-strategy="always"
  >
    <template #item="{ item, hasSubmenu }">
      <div class="flex w-full items-center gap-2">
        <span
          v-if="getItemColor(item)"
          class="size-5 rounded-full border"
          :style="{ backgroundColor: getItemColor(item) }"
        />
        <i v-else-if="item.icon" :class="item.icon" />
        <span class="flex-1">{{ item.label }}</span>
        <span
          v-if="item.shortcut"
          class="ml-auto rounded-sm border bg-secondary p-1 text-xs text-nowrap text-muted-foreground"
        >
          {{ item.shortcut }}
        </span>
        <i v-if="hasSubmenu" class="icon-[lucide--chevron-right] opacity-60" />
      </div>
    </template>
  </Menu>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import Menu from '@comfyorg/design-system/menu/Menu'
import { getMenuAnchorPosition } from '@comfyorg/design-system/lib/menu/menuAnchor'
import { usePointMenu } from '@comfyorg/design-system/lib/menu/usePointMenu'
import type {
  MenuItem,
  MenuItemAction,
  MenuItemRadioGroup,
  MenuItemSeparator,
  MenuItemSubmenu
} from '@comfyorg/design-system/lib/menu/types'
import {
  registerNodeOptionsInstance,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'
import type { MenuOption } from '@/composables/graph/menuOption'
import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

const { menuOptions, bump } = useMoreOptionsMenu()
const { getCurrentShape } = useNodeCustomization()
const canvasStore = useCanvasStore()

interface NodeMenuMetadata {
  color?: string
}

type NodeMenuAction = MenuItemAction & NodeMenuMetadata

type NodeMenuSubmenu = Omit<MenuItemSubmenu, 'items'> &
  NodeMenuMetadata & {
    items: NodeMenuItem[]
  }

type NodeMenuItem =
  | MenuItemSeparator
  | NodeMenuAction
  | NodeMenuSubmenu
  | MenuItemRadioGroup

function getItemColor(item: MenuItem): string | undefined {
  return 'color' in item && typeof item.color === 'string'
    ? item.color
    : undefined
}

const worldPosition = ref({ x: 0, y: 0 })

const lgCanvas = canvasStore.getCanvas()
const menuReference = {
  contextElement: lgCanvas.canvas,
  getBoundingClientRect() {
    const { scale, offset } = lgCanvas.ds
    const { left, top } = lgCanvas.canvas.getBoundingClientRect()
    return new DOMRect(
      (worldPosition.value.x + offset[0]) * scale + left,
      (worldPosition.value.y + offset[1]) * scale + top,
      1,
      1
    )
  }
}

function convertToMenuItem(option: MenuOption): NodeMenuItem {
  if (option.type === 'divider') return { separator: true }

  if (option.isShapePicker && option.submenu) {
    return {
      label: option.label,
      icon: option.icon,
      radioGroup: {
        value: getCurrentShape()?.localizedName ?? '',
        options: option.submenu.map((sub) => ({
          value: sub.label,
          label: sub.label,
          command: sub.action
        }))
      }
    }
  }

  if (option.hasSubmenu && option.submenu) {
    return {
      label: option.label,
      icon: option.icon,
      disabled: option.disabled,
      shortcut: option.shortcut,
      items: option.submenu.map((sub) => ({
        label: sub.label,
        icon: sub.icon,
        color: sub.color,
        disabled: sub.disabled,
        command: sub.action
      }))
    }
  }

  return {
    label: option.label,
    icon: option.icon,
    disabled: option.disabled,
    shortcut: option.shortcut,
    command: option.action
  }
}

const menuItems = computed<MenuItem[]>(() =>
  menuOptions.value.map(convertToMenuItem)
)

function placeAtEvent(event: Event) {
  if (event.type === 'contextmenu') event.preventDefault()
  bump()

  const { x, y } = getMenuAnchorPosition(event)
  const { left, top } = lgCanvas.canvas.getBoundingClientRect()
  const { scale, offset } = lgCanvas.ds
  worldPosition.value = {
    x: (x - left) / scale - offset[0],
    y: (y - top) / scale - offset[1]
  }
}

const {
  open: isOpen,
  menuProps,
  show,
  hide,
  toggle
} = usePointMenu(placeAtEvent)

onMounted(() => {
  registerNodeOptionsInstance({ toggle, show, hide, isOpen })
})

onUnmounted(() => {
  registerNodeOptionsInstance(null)
})
</script>
