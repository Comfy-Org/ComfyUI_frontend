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
  >
    <div
      class="flex min-w-[14rem] flex-col items-stretch rounded-lg border border-interface-stroke bg-interface-panel-surface px-2 py-3 font-inter"
    >
      <template v-for="entry in entries" :key="entry.key">
        <div v-if="entry.kind === 'divider'" class="px-2 py-1">
          <div class="h-px bg-interface-stroke" />
        </div>
        <IconTextButton
          v-else
          class="w-full justify-start gap-2 bg-transparent p-2 font-inter text-[12px] leading-none text-text-primary hover:bg-interface-panel-hover-surface"
          type="transparent"
          :label="entry.label"
          :aria-label="entry.label"
          @click="onEntry(entry)"
        >
          <template #icon>
            <i
              v-if="entry.icon"
              :class="[
                entry.icon,
                'block size-4 shrink-0 leading-none text-text-secondary'
              ]"
            />
          </template>
        </IconTextButton>
      </template>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import { ref } from 'vue'

import IconTextButton from '@/components/button/IconTextButton.vue'
import type { MenuEntry } from '@/composables/queue/useJobMenu'

defineProps<{ entries: MenuEntry[] }>()

const emit = defineEmits<{
  (e: 'action', entry: MenuEntry): void
}>()

const jobItemPopoverRef = ref<InstanceType<typeof Popover> | null>(null)

function open(event: Event) {
  if (jobItemPopoverRef.value) {
    jobItemPopoverRef.value.toggle(event)
  }
}

function hide() {
  jobItemPopoverRef.value?.hide()
}

function onEntry(entry: MenuEntry) {
  emit('action', entry)
}

defineExpose({ open, hide })
</script>
