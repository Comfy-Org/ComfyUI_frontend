<script setup lang="ts">
import { Check } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { GeneratedExample } from '../../config/models-catalogue'
import WorkflowExamplePreview from './WorkflowExamplePreview.vue'

const {
  example,
  chosen,
  poster,
  disabled = false
} = defineProps<{
  example: GeneratedExample
  chosen: boolean
  poster?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <button
    type="button"
    :aria-current="chosen ? 'true' : undefined"
    :class="
      cn(
        'relative cursor-pointer overflow-hidden rounded-2xl text-left ring-1 transition-all focus-visible:outline-primary-comfy-yellow disabled:cursor-not-allowed disabled:opacity-50',
        chosen
          ? 'ring-2 ring-primary-comfy-yellow'
          : 'ring-transparency-white-t8 hover:ring-transparency-white-t20 hover:brightness-110'
      )
    "
    :disabled
    @click="emit('open')"
  >
    <WorkflowExamplePreview :example :poster />
    <span
      v-if="chosen"
      class="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-primary-comfy-yellow text-primary-comfy-ink"
      data-testid="workflow-example-chosen"
    >
      <Check class="size-3" :stroke-width="3" aria-hidden="true" />
    </span>
    <span class="block p-4 text-sm text-primary-warm-gray">
      {{ example.title }}
    </span>
  </button>
</template>
