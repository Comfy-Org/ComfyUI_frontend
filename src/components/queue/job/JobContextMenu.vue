<template>
  <Popover
    ref="jobItemPopoverRef"
    :dismissable="false"
    align="start"
    :side-offset="8"
    :content-class="cn(menuContentClass, 'min-w-56')"
    @show="isVisible = true"
    @hide="onHide"
  >
    <div ref="contentRef" class="flex flex-col">
      <template v-for="entry in entries" :key="entry.key">
        <div v-if="entry.kind === 'divider'" class="px-2 py-1">
          <div class="h-px bg-interface-stroke" />
        </div>
        <button
          v-else
          type="button"
          :class="menuButtonClass"
          :aria-label="entry.label"
          :disabled="entry.disabled"
          @click="onEntry(entry)"
        >
          <i
            v-if="entry.icon"
            :class="[
              entry.icon,
              'block size-4 shrink-0 leading-none text-text-secondary'
            ]"
          />
          <span>{{ entry.label }}</span>
        </button>
      </template>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import Popover from '@/components/common/ImperativePopover.vue'
import { nextTick, ref } from 'vue'

import {
  menuButtonClass,
  menuContentClass
} from '@/components/ui/menu/menuStyles'
import { useDismissableOverlay } from '@/composables/useDismissableOverlay'
import type { MenuEntry } from '@/composables/queue/useJobMenu'
import { cn } from '@comfyorg/tailwind-utils'

defineProps<{ entries: MenuEntry[] }>()

const emit = defineEmits<{
  (e: 'action', entry: MenuEntry): void
}>()

type PopoverHandle = {
  hide: () => void
  show: (event: Event, target?: EventTarget | null) => void
}

const jobItemPopoverRef = ref<PopoverHandle | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)
const openedByClick = ref(false)

useDismissableOverlay({
  isOpen: isVisible,
  getOverlayEl: () => contentRef.value,
  getTriggerEl: () => (openedByClick.value ? triggerRef.value : null),
  onDismiss: hide
})

async function open(event: Event) {
  const trigger =
    event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const isSameClickTrigger =
    event.type === 'click' && trigger === triggerRef.value && isVisible.value

  if (isSameClickTrigger) {
    hide()
    return
  }

  openedByClick.value = event.type === 'click'
  triggerRef.value = trigger

  if (isVisible.value) {
    hide()
    await nextTick()
  }

  jobItemPopoverRef.value?.show(event, trigger)
}

function hide() {
  jobItemPopoverRef.value?.hide()
}

function onHide() {
  isVisible.value = false
  openedByClick.value = false
}

function onEntry(entry: MenuEntry) {
  if (entry.kind === 'divider' || entry.disabled) return
  emit('action', entry)
}

defineExpose({ open, hide })
</script>
