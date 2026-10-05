<template>
  <ContextMenu
    ref="contextMenu"
    :model="menuItems"
    :reference="menuReference"
    @show="onMenuShow"
    @hide="onMenuHide"
  >
    <template #item="{ item, hasSubmenu }">
      <div class="flex w-full items-center gap-2">
        <span
          v-if="getItemColor(item)"
          class="size-5 rounded-full border border-border-default"
          :style="{ backgroundColor: getItemColor(item) }"
        />
        <i v-else-if="item.icon" :class="cn(item.icon, 'size-4')" />
        <span class="flex-1">{{ item.label }}</span>
        <span
          v-if="item.shortcut"
          class="ml-auto rounded-sm border border-border-default bg-secondary-background p-1 text-xs text-nowrap text-muted"
        >
          {{ item.shortcut }}
        </span>
        <i
          v-if="hasSubmenu"
          class="icon-[lucide--chevron-right] size-4 opacity-60"
        />
      </div>
    </template>
  </ContextMenu>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import ContextMenu from '@/components/ui/menu/ContextMenu.vue'
import { getMenuAnchorPosition } from '@/components/ui/menu/menuAnchor'
import type {
  MenuItem,
  MenuItemAction,
  MenuItemRadioGroup,
  MenuItemSeparator,
  MenuItemSubmenu
} from '@/components/ui/menu/types'
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

function prepareMenu(event: Event) {
  bump()

  const { x, y } = getMenuAnchorPosition(event)
  const { left, top } = lgCanvas.canvas.getBoundingClientRect()
  const { scale, offset } = lgCanvas.ds
  worldPosition.value = {
    x: (x - left) / scale - offset[0],
    y: (y - top) / scale - offset[1]
  }
}

function show(event: MouseEvent) {
  prepareMenu(event)
  contextMenu.value?.show(event)
}

function hide() {
  contextMenu.value?.hide()
}

function toggle(event: Event) {
  prepareMenu(event)
  contextMenu.value?.toggle(event)
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
