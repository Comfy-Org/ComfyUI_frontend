<template>
  <div
    :class="
      cn(
        'group @container relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg bg-secondary-background pt-3 pb-2 transition-colors duration-150 select-none hover:bg-secondary-background-hover',
        nodeDef ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      )
    "
    :draggable="nodeDef != null"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @click="handleClick"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
  >
    <div
      v-if="tile.iconUrl && tile.tintable"
      :class="cn(iconSizeClass, 'bg-base-foreground')"
      :style="{
        maskImage: `url(${tile.iconUrl})`,
        WebkitMaskImage: `url(${tile.iconUrl})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center'
      }"
    />
    <img
      v-else-if="tile.iconUrl"
      :src="tile.iconUrl"
      :alt="tile.label"
      :class="cn(iconSizeClass, 'object-contain')"
      draggable="false"
    />
    <i v-else :class="cn(tile.icon, iconSizeClass, 'text-muted-foreground')" />
    <TextTickerMultiLine
      :class="
        cn(
          'text-foreground flex w-full shrink-0 flex-col justify-center px-2 text-center font-normal',
          textSizeClass
        )
      "
    >
      {{ tile.label }}
    </TextTickerMultiLine>
  </div>

  <Teleport v-if="showPopover" to="body">
    <div :ref="(el) => (popoverRef = el as HTMLElement)" :style="popoverStyle">
      <EssentialNodePlaceholderPopover :tile="tile" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CSSProperties } from 'vue'

import TextTickerMultiLine from '@/components/common/TextTickerMultiLine.vue'
import { useEssentialTileNodeDef } from '@/composables/useEssentialTileNodeDef'
import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'
import type { EssentialPlaceholderTile } from '@/constants/essentialsPlaceholders'
import { useSettingStore } from '@/platform/settings/settingStore'
import { cn } from '@comfyorg/tailwind-utils'

import EssentialNodePlaceholderPopover from './EssentialNodePlaceholderPopover.vue'

const { tile } = defineProps<{
  tile: EssentialPlaceholderTile
}>()

const iconSizeClass = 'size-7'
const textSizeClass =
  'h-[30px] text-xs/[15px] @[112px]:h-[36px] @[112px]:text-sm/[18px]'

const POPOVER_WIDTH = 200
const POPOVER_MARGIN = 16

const settingStore = useSettingStore()
const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

const nodeDef = useEssentialTileNodeDef(() => tile)
const { isDragging, startDrag, handleNativeDrop } = useNodeDragToCanvas()

const isHovered = ref(false)
const showPopover = computed(() => isHovered.value && !isDragging.value)
const popoverRef = ref<HTMLElement | null>(null)
const popoverStyle = ref<CSSProperties>({
  position: 'fixed',
  top: '0px',
  left: '0px',
  pointerEvents: 'none',
  zIndex: 1000
})

function handleMouseEnter(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  let left =
    sidebarLocation.value === 'left'
      ? rect.right + POPOVER_MARGIN
      : rect.left - POPOVER_MARGIN - POPOVER_WIDTH
  if (left + POPOVER_WIDTH > viewportWidth)
    left = rect.left - POPOVER_MARGIN - POPOVER_WIDTH
  if (left < 0) left = rect.right + POPOVER_MARGIN

  popoverStyle.value = {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${left}px`,
    pointerEvents: 'none',
    zIndex: 1000,
    opacity: 0
  }
  isHovered.value = true

  requestAnimationFrame(() => {
    if (!popoverRef.value) return
    const previewHeight = popoverRef.value.getBoundingClientRect().height
    const mouseY = rect.top + rect.height / 2
    let top = mouseY - previewHeight * 0.3
    const minTop = POPOVER_MARGIN
    const maxTop = viewportHeight - previewHeight - POPOVER_MARGIN
    top = Math.max(minTop, Math.min(top, maxTop))
    popoverStyle.value = {
      ...popoverStyle.value,
      top: `${top}px`,
      opacity: 1
    }
  })
}

function handleMouseLeave() {
  isHovered.value = false
}

function createEmptyDragImage(): HTMLElement {
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  el.style.top = '-9999px'
  el.style.width = '1px'
  el.style.height = '1px'
  return el
}

function handleClick() {
  if (!nodeDef.value) return
  startDrag(nodeDef.value, 'click')
  isHovered.value = false
}

function handleDragStart(e: DragEvent) {
  if (!nodeDef.value) {
    e.preventDefault()
    return
  }
  isHovered.value = false
  startDrag(nodeDef.value, 'native')

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/x-comfy-node', nodeDef.value.name)

    const dragImage = createEmptyDragImage()
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 0, 0)
    requestAnimationFrame(() => {
      document.body.removeChild(dragImage)
    })
  }
}

function handleDragEnd(e: DragEvent) {
  handleNativeDrop(e.clientX, e.clientY)
}
</script>
