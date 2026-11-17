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
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useMutationObserver } from '@vueuse/core'

import Menu from '@comfyorg/design-system/menu/Menu'
import { getMenuAnchorPosition } from '@comfyorg/design-system/lib/menu/menuAnchor'
import { usePointMenu } from '@comfyorg/design-system/lib/menu/usePointMenu'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import {
  registerNodeOptionsInstance,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'
import {
  projectNodeMenu,
  toLegacyNodeMenu
} from '@/composables/graph/nodeMenuBoundary'
import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'
import { withNodeMenuSource } from '@/lib/litegraph/src/canvas/nodeMenuSource'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

const { menuOptions, invocationContext, bump } = useMoreOptionsMenu()
const { getCurrentShape } = useNodeCustomization()
const canvasStore = useCanvasStore()

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

const menuItems = shallowRef<MenuItem[]>([])
const nativeMenu = shallowRef<InstanceType<typeof LiteGraph.ContextMenu>>()
const nativeRoot = shallowRef<HTMLElement>()
const nativeOpen = ref(false)
useMutationObserver(
  nativeRoot,
  () => {
    nativeOpen.value = nativeMenu.value?.root.isConnected ?? false
  },
  { childList: true }
)

function placeAtEvent(event: Event) {
  if (event.type === 'contextmenu') event.preventDefault()
  const { x, y } = getMenuAnchorPosition(event)
  const { left, top } = lgCanvas.canvas.getBoundingClientRect()
  const { scale, offset } = lgCanvas.ds
  worldPosition.value = {
    x: (x - left) / scale - offset[0],
    y: (y - top) / scale - offset[1]
  }
}

const {
  open: vueOpen,
  menuProps,
  show: showVue,
  hide: hideVue,
  toggle: toggleVue
} = usePointMenu(placeAtEvent)

const isOpen = computed(() => vueOpen.value || nativeOpen.value)

function closeNative() {
  nativeMenu.value?.close()
  nativeMenu.value = undefined
  nativeRoot.value = undefined
  nativeOpen.value = false
}

function prepare(event: Event): boolean {
  if (event.type === 'contextmenu') event.preventDefault()
  closeNative()
  bump()
  const selected = canvasStore.selectedItems.filter(isLGraphNode)
  const node = invocationContext.value
    ? canvasStore.currentGraph?.getNodeById(invocationContext.value.nodeId)
    : selected[0]
  const source = () =>
    toLegacyNodeMenu(menuOptions.value, getCurrentShape()?.localizedName ?? '')
  const items =
    node && selected.length === 1
      ? withNodeMenuSource(lgCanvas, source, () =>
          lgCanvas.getNodeMenuOptions(node)
        )
      : source()
  const result = projectNodeMenu(items)
  if (result.kind === 'vue') {
    menuItems.value = result.items
    return true
  }
  hideVue()
  const { x, y } = getMenuAnchorPosition(event)
  if (node) LGraphCanvas.active_node = node
  nativeMenu.value = new LiteGraph.ContextMenu(result.items, {
    event: event instanceof MouseEvent ? event : undefined,
    left: x,
    top: y,
    extra: node
  })
  nativeRoot.value = nativeMenu.value.root.parentElement ?? undefined
  nativeOpen.value = nativeMenu.value.root.isConnected
  return false
}

function show(event: Event) {
  if (prepare(event)) showVue(event)
}

function hide() {
  closeNative()
  hideVue()
}

function toggle(event: Event) {
  if (nativeOpen.value) hide()
  else if (vueOpen.value || prepare(event)) toggleVue(event)
}

onMounted(() => {
  registerNodeOptionsInstance({ toggle, show, hide, isOpen })
})

onUnmounted(() => {
  closeNative()
  registerNodeOptionsInstance(null)
})
</script>
