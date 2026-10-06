<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DirectoryControlSize, DirectoryOption } from './directoryControls'

const {
  label,
  options,
  size = 'default'
} = defineProps<{
  label: string
  options: readonly (DirectoryOption<T> & { icon?: Component })[]
  size?: DirectoryControlSize
}>()

const selected = defineModel<T>({ required: true })
</script>

<template>
  <div
    role="group"
    :aria-label="label"
    class="flex gap-1 rounded-2xl border border-white/15 p-1.5"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="selected === option.value"
      :class="
        cn(
          'flex h-8 cursor-pointer items-center gap-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors',
          size === 'compact' ? 'px-2 min-[375px]:px-4' : 'px-3',
          selected === option.value
            ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
            : 'text-primary-comfy-canvas hover:bg-white/10'
        )
      "
      @click="selected = option.value"
    >
      <component
        :is="option.icon"
        v-if="option.icon"
        class="size-3.5"
        aria-hidden="true"
      />
      {{ option.label }}
    </button>
  </div>
</template>
