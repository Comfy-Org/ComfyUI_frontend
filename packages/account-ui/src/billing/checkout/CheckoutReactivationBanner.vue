<template>
  <div
    class="mb-6 flex gap-3 rounded-2xl border border-warning-background bg-warning-background/20 p-4"
  >
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-full text-warning-background"
    >
      <i class="pi pi-info-circle" />
    </div>
    <div class="flex flex-col gap-2">
      <p class="m-0 text-sm font-bold text-base-foreground">
        {{ title }}
      </p>
      <p class="m-0 text-sm text-muted-foreground">
        <span>
          <template v-for="(segment, index) in segments" :key="index">
            <span v-if="segment.emphasis" :class="amountClass">{{
              segment.text
            }}</span>
            <template v-else>{{ segment.text }}</template>
          </template>
        </span>
      </p>
      <label
        v-if="checkboxLabel"
        class="flex items-center gap-2 pt-1 text-sm text-muted-foreground"
      >
        <input
          v-model="confirmed"
          type="checkbox"
          class="size-4 rounded-sm border-interface-stroke"
        />
        {{ checkboxLabel }}
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The plan-change confirm's disclosure that the change reactivates a
 * subscription set to end. A charge above the current monthly price is
 * emphasised and has to be acknowledged (`checkboxLabel` set).
 */
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { title, segments, checkboxLabel } = defineProps<{
  title: string
  /** The body, with the charge marked for emphasis. */
  segments: readonly { text: string; emphasis: boolean }[]
  checkboxLabel: string | null
}>()

const confirmed = defineModel<boolean>('confirmed', { required: true })

const amountClass = computed(() =>
  cn(
    'font-bold text-base-foreground',
    checkboxLabel !== null && 'text-base font-extrabold'
  )
)
</script>
