<script setup lang="ts">
import { Check } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { GeneratedExample } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import WorkflowExamplePreview from './WorkflowExamplePreview.vue'

const {
  example,
  chosen,
  poster,
  disabled = false,
  locale = 'en'
} = defineProps<{
  example: GeneratedExample
  chosen: boolean
  poster?: string
  disabled?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <div
    :class="
      cn(
        'relative overflow-hidden rounded-2xl text-left ring-1 transition-all focus-within:outline-primary-comfy-yellow',
        chosen
          ? 'ring-2 ring-primary-comfy-yellow'
          : 'ring-transparency-white-t8 hover:ring-transparency-white-t20 hover:brightness-110'
      )
    "
  >
    <WorkflowExamplePreview
      v-if="example.mediaKind === 'video'"
      :example
      :poster
      :locale
    />
    <button
      type="button"
      :aria-current="chosen ? 'true' : undefined"
      :disabled
      class="block w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-comfy-yellow disabled:cursor-not-allowed disabled:opacity-50"
      @click="emit('open')"
    >
      <WorkflowExamplePreview
        v-if="example.mediaKind !== 'video'"
        :example
        :poster
        :locale
      />
      <span
        v-if="chosen"
        class="pointer-events-none absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-primary-comfy-yellow text-primary-comfy-ink"
        data-testid="workflow-example-chosen"
      >
        <Check class="size-3" :stroke-width="3" aria-hidden="true" />
      </span>
      <span class="block p-4 text-sm text-primary-warm-gray">
        {{ example.title }}
      </span>
    </button>
  </div>
</template>
