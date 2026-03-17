<template>
  <Popover
    ref="jobItemPopoverRef"
    :dismissable="false"
    :close-on-escape="true"
    unstyled
    :pt="{
      root: { class: 'absolute z-50' },
      content: {
        class: [
          'bg-transparent border-none p-0 pt-2 rounded-lg shadow-lg font-inter'
        ]
      }
    }"
    @show="isVisible = true"
    @hide="onHide"
  >
    <div
      ref="contentRef"
      class="flex min-w-56 flex-col items-stretch rounded-lg border border-interface-stroke bg-interface-panel-surface px-2 py-3 font-inter"
    >
      <template v-for="entry in entries" :key="entry.key">
        <div v-if="entry.kind === 'divider'" class="px-2 py-1">
          <div class="h-px bg-interface-stroke" />
        </div>
        <Button
          v-else
          class="w-full justify-start bg-transparent"
          variant="textonly"
          size="sm"
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
        </Button>
      </template>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import { nextTick, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useDismissableOverlay } from '@/composables/useDismissableOverlay'
import type { MenuEntry } from '@/composables/queue/useJobMenu'

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
