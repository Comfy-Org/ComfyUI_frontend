<template>
  <Popover
    ref="jobItemPopoverRef"
    :dismissable="true"
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
    @hide="isOpen = false"
  >
    <div
      class="flex min-w-[14rem] flex-col items-stretch rounded-lg border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] px-2 py-3 font-inter"
    >
      <template v-for="entry in entries" :key="entry.key">
        <div v-if="entry.kind === 'divider'" class="px-2 py-1">
          <div class="h-px bg-[var(--color-charcoal-400)]" />
        </div>
        <button
          v-else
          class="inline-flex w-full items-center justify-start gap-2 rounded-lg border-0 bg-transparent p-2 font-inter text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
          :aria-label="entry.label"
          @click="onEntry(entry)"
        >
          <i
            v-if="entry.icon"
            :class="[
              entry.icon,
              'block size-4 shrink-0 leading-none text-white'
            ]"
          />
          <span>{{ entry.label }}</span>
        </button>
      </template>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import { ref } from 'vue'

import type { MenuEntry } from '@/composables/queue/useJobMenu'

defineProps<{ entries: MenuEntry[] }>()

const emit = defineEmits<{
  (e: 'action', entry: MenuEntry): void
}>()

const jobItemPopoverRef = ref<InstanceType<typeof Popover> | null>(null)
const isOpen = ref(false)

function open(event: Event) {
  if (jobItemPopoverRef.value) {
    jobItemPopoverRef.value.toggle(event)
    isOpen.value = !isOpen.value
  }
}

function hide() {
  jobItemPopoverRef.value?.hide()
  isOpen.value = false
}

function onEntry(entry: MenuEntry) {
  emit('action', entry)
}

defineExpose({ open, hide })
</script>
