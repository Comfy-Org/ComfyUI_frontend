<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { ChevronDown } from '@lucide/vue'

const { label, options, labelWidth } = defineProps<{
  label: string
  options: string[]
  labelWidth?: string
}>()

const selected = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex h-[1.625em] items-center gap-[0.625em] text-[0.75em]">
    <span :class="cn('shrink-0 text-white/60', labelWidth)">{{ label }}</span>
    <div
      class="relative flex h-full min-w-0 flex-1 items-center rounded-[0.375em] bg-black/25"
    >
      <select
        v-model="selected"
        :aria-label="label"
        class="size-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-[1.375em] pl-[0.625em] text-white/90 outline-none"
      >
        <option
          v-for="option in options"
          :key="option"
          class="bg-primary-comfy-ink-light"
        >
          {{ option }}
        </option>
      </select>
      <ChevronDown
        class="pointer-events-none absolute right-[0.375em] size-[0.75em] text-white/50"
        aria-hidden="true"
      />
    </div>
    <slot name="trailing" />
  </div>
</template>
