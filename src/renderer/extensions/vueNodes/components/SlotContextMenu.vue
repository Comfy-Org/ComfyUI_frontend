<template>
  <ContextMenuRoot :open="isOpen" :modal="false" @update:open="setOpen">
    <ContextMenuTrigger as-child>
      <div
        ref="contextMenuTrigger"
        data-testid="slot-context-menu-anchor"
        class="pointer-events-none fixed size-px"
        :style="anchorStyle"
      />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="z-1000 max-h-[80vh] min-w-56 overflow-y-auto rounded-lg border border-border-subtle bg-base-background px-2 py-3 shadow-interface"
      >
        <template v-for="(item, index) in menuItems" :key="index">
          <ContextMenuSeparator
            v-if="item.separator"
            class="my-1 h-px bg-border-subtle"
          />
          <ContextMenuItem
            v-else
            class="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-text-primary outline-none select-none hover:bg-node-component-surface-hovered focus:bg-node-component-surface-hovered data-disabled:cursor-default data-disabled:opacity-50"
            :disabled="item.disabled"
            @select="item.command"
          >
            <span class="flex-1">{{ item.label }}</span>
          </ContextMenuItem>
        </template>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<script setup lang="ts">
import { useElementBounding, useRafFn } from '@vueuse/core'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger
} from 'reka-ui'
import type { CSSProperties } from 'vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  canRenameSlot,
  connectSlots,
  findCompatibleTargets,
  registerSlotMenuInstance,
  renameSlot
} from '@/renderer/extensions/vueNodes/composables/useSlotContextMenu'
import type { SlotMenuContext } from '@/renderer/extensions/vueNodes/composables/useSlotContextMenu'

interface SlotMenuItem {
  label?: string
  separator?: boolean
  disabled?: boolean
  command?: () => void
}

const contextMenuTrigger = ref<HTMLElement>()
const isOpen = ref(false)
const activeContext = ref<SlotMenuContext | null>(null)

const canvasStore = useCanvasStore()
const lgCanvas = canvasStore.getCanvas()
const { t } = useI18n()
const { left: canvasLeft, top: canvasTop } = useElementBounding(lgCanvas.canvas)
const worldPosition = ref({ x: 0, y: 0 })
const screenPosition = ref({ x: 0, y: 0 })

const anchorStyle = computed<CSSProperties>(() => ({
  left: `${screenPosition.value.x}px`,
  top: `${screenPosition.value.y}px`,
  pointerEvents: 'none'
}))

function updateAnchorPosition() {
  const { scale, offset } = lgCanvas.ds
  screenPosition.value = {
    x: (worldPosition.value.x + offset[0]) * scale + canvasLeft.value,
    y: (worldPosition.value.y + offset[1]) * scale + canvasTop.value
  }
  if (isOpen.value) dispatchContextMenuEvent()
}

function dispatchContextMenuEvent() {
  contextMenuTrigger.value?.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      clientX: screenPosition.value.x,
      clientY: screenPosition.value.y
    })
  )
}

const { resume: startSync, pause: stopSync } = useRafFn(updateAnchorPosition, {
  immediate: false
})

watch(isOpen, (open) => (open ? startSync() : stopSync()))

const menuItems = computed<SlotMenuItem[]>(() => {
  const ctx = activeContext.value
  if (!ctx) return []

  const items: SlotMenuItem[] = []

  if (canRenameSlot(ctx)) {
    items.push({
      label: t('g.renameSlot'),
      command: () => {
        const newLabel = window.prompt(t('g.newSlotLabel'))
        if (newLabel !== null) renameSlot(ctx, newLabel)
        hide()
      }
    })
    items.push({ separator: true })
  }

  const targets = findCompatibleTargets(ctx)
  if (targets.length === 0) {
    items.push({ label: t('g.noCompatibleNodes'), disabled: true })
  } else {
    items.push({ label: t('g.connectTo'), disabled: true })
    items.push({ separator: true })
    items.push(
      ...targets.map((target) => ({
        label: `${target.slotInfo.name} @ ${target.node.title || target.node.type}`,
        command: () => {
          connectSlots(ctx, target)
          hide()
        }
      }))
    )
  }

  return items
})

async function show(event: MouseEvent, context: SlotMenuContext) {
  activeContext.value = context
  const { scale, offset } = lgCanvas.ds
  worldPosition.value = {
    x: (event.clientX - canvasLeft.value) / scale - offset[0],
    y: (event.clientY - canvasTop.value) / scale - offset[1]
  }
  updateAnchorPosition()

  await nextTick()
  dispatchContextMenuEvent()
}

function hide() {
  setOpen(false)
}

function setOpen(open: boolean) {
  isOpen.value = open
  if (!open) activeContext.value = null
}

defineExpose({ show, hide, isOpen })

onMounted(() => registerSlotMenuInstance({ show, hide, isOpen }))
onUnmounted(() => registerSlotMenuInstance(null))
</script>
