<script setup lang="ts">
import type { SlotDefinition } from '@/types/node'
import { getSlotColor } from '@/types/node'
import SlotDot from './SlotDot.vue'

interface Props {
  inputs: SlotDefinition[]
  outputs: SlotDefinition[]
}

const props = defineProps<Props>()

// Filter out hidden slots
const visibleInputs = props.inputs.filter(s => !s.hidden)
const visibleOutputs = props.outputs.filter(s => !s.hidden)
</script>

<template>
  <div class="flex justify-between min-w-0">
    <!-- Input slots (left side) -->
    <div v-if="visibleInputs.length" class="flex flex-col min-w-0">
      <div
        v-for="(input, index) in visibleInputs"
        :key="`input-${index}`"
        class="flex items-center gap-1.5 h-[22px] pr-3 group"
      >
        <SlotDot
          :color="getSlotColor(input.type)"
          side="left"
        />
        <span class="text-[11px] text-zinc-400 truncate">
          {{ input.label || input.name }}
        </span>
      </div>
    </div>

    <div v-else class="flex-1" />

    <!-- Output slots (right side) -->
    <div v-if="visibleOutputs.length" class="flex flex-col items-end min-w-0 ml-auto">
      <div
        v-for="(output, index) in visibleOutputs"
        :key="`output-${index}`"
        class="flex items-center gap-1.5 h-[22px] pl-3 group"
      >
        <span class="text-[11px] text-zinc-400 truncate uppercase tracking-wide">
          {{ output.label || output.name }}
        </span>
        <SlotDot
          :color="getSlotColor(output.type)"
          side="right"
        />
      </div>
    </div>
  </div>
</template>
