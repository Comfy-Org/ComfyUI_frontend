<script setup lang="ts">
import { Sparkles } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import type {
  CollectionChip,
  WorkflowCollection
} from '@/lib/workshop/workflow-modality-tasks'

const { chips, label } = defineProps<{
  chips: readonly CollectionChip[]
  label: string
}>()

const selected = defineModel<'all' | WorkflowCollection>({ required: true })

function toggle(key: WorkflowCollection) {
  selected.value = selected.value === key ? 'all' : key
}
</script>

<template>
  <!-- One line that scrolls sideways, so many collections never push the grid down. -->
  <div
    v-if="chips.length"
    role="group"
    :aria-label="label"
    class="-mx-1 mb-6 scrollbar-none flex gap-2 overflow-x-auto px-1 py-1"
    data-testid="workflow-collections"
  >
    <button
      v-for="chip in chips"
      :key="chip.key"
      type="button"
      :aria-pressed="selected === chip.key"
      :class="
        cn(
          'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
          selected === chip.key
            ? 'bg-primary-warm-white text-primary-comfy-ink'
            : 'bg-primary-comfy-plum/60 text-primary-warm-white hover:bg-primary-comfy-plum'
        )
      "
      @click="toggle(chip.key)"
    >
      <Sparkles class="size-3.5 shrink-0" aria-hidden="true" />
      {{ chip.label }}
      <span class="tabular-nums opacity-70">{{ chip.count }}</span>
    </button>
  </div>
</template>
