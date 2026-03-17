<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="menuEl"
      :style="{
        left: `${screenPosition.x}px`,
        top: `${screenPosition.y}px`
      }"
      class="fixed z-1700 min-w-[220px] rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm"
      role="menu"
    >
      <div
        v-if="showDisconnect"
        class="m-1 flex cursor-pointer items-center gap-1 rounded-lg p-2 leading-none hover:bg-secondary-background-hover"
        role="menuitem"
        tabindex="0"
        @click="handleDisconnect"
      >
        {{ t('g.disconnectLinks') }}
      </div>
      <div
        v-if="showRename"
        class="m-1 flex cursor-pointer items-center gap-1 rounded-lg p-2 leading-none hover:bg-secondary-background-hover"
        role="menuitem"
        tabindex="0"
        @click="handleRename"
      >
        {{ t('g.rename') }}
      </div>
      <div
        v-if="showRemove"
        class="m-1 flex cursor-pointer items-center gap-1 rounded-lg p-2 leading-none text-error hover:bg-secondary-background-hover"
        role="menuitem"
        tabindex="0"
        @click="handleRemove"
      >
        {{ t('g.removeSlot') }}
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onClickOutside, useEventListener } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCanvasAnchoredPosition } from '@/composables/graph/useCanvasAnchoredPosition'
import {
  canDisconnectSlot,
  canRemoveSlot,
  canRenameSlot,
  disconnectSlotLinks,
  registerSlotMenuInstance,
  removeSlot,
  renameSlot
} from '@/renderer/extensions/vueNodes/composables/slotMenuService'
import type { SlotMenuContext } from '@/renderer/extensions/vueNodes/composables/slotMenuService'
import { useDialogService } from '@/services/dialogService'

const { t } = useI18n()
const dialogService = useDialogService()

const isOpen = ref(false)
const activeContext = ref<SlotMenuContext | null>(null)
const menuEl = ref<HTMLElement | null>(null)

const { screenPosition, anchorToEvent } = useCanvasAnchoredPosition(isOpen)

const showDisconnect = computed(
  () => activeContext.value && canDisconnectSlot(activeContext.value)
)
const showRename = computed(
  () => activeContext.value && canRenameSlot(activeContext.value)
)
const showRemove = computed(
  () => activeContext.value && canRemoveSlot(activeContext.value)
)

function show(event: MouseEvent, context: SlotMenuContext) {
  activeContext.value = context
  anchorToEvent(event)
  isOpen.value = true
}

function hide() {
  isOpen.value = false
  activeContext.value = null
}

function handleDisconnect() {
  if (!activeContext.value) return
  disconnectSlotLinks(activeContext.value)
  hide()
}

async function handleRename() {
  const ctx = activeContext.value
  if (!ctx) return
  hide()
  const newLabel = await dialogService
    .prompt({
      title: t('g.rename'),
      message: t('g.enterNewNamePrompt')
    })
    .catch(() => null)
  if (!newLabel) return
  renameSlot(ctx, newLabel)
}

function handleRemove() {
  if (!activeContext.value) return
  removeSlot(activeContext.value)
  hide()
}

onClickOutside(menuEl, () => {
  if (isOpen.value) hide()
})

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isOpen.value) hide()
})

defineExpose({ show, hide, isOpen })

onMounted(() => {
  registerSlotMenuInstance({ show, hide, isOpen })
})

onUnmounted(() => {
  registerSlotMenuInstance(null)
})
</script>
