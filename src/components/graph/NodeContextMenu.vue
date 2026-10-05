<template>
  <ContextMenu
    ref="contextMenu"
    :model="menuItems"
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
import { useElementBounding, useRafFn } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'

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
const { left: canvasLeft, top: canvasTop } = useElementBounding(lgCanvas.canvas)

let lastScale = 0
let lastOffsetX = 0
let lastOffsetY = 0

const updateMenuPosition = () => {
  if (!isOpen.value) return

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

  contextMenu.value?.updatePosition({ x: screenX, y: screenY })
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
  const screenX = x - canvasLeft.value
  const screenY = y - canvasTop.value

  const { scale, offset } = lgCanvas.ds
  worldPosition.value = {
    x: screenX / scale - offset[0],
    y: screenY / scale - offset[1]
  }

  lastScale = scale
  lastOffsetX = offset[0]
  lastOffsetY = offset[1]
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
