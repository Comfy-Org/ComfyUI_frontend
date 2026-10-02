<script setup lang="ts" generic="T extends string">
import { ChevronDown, Maximize } from '@lucide/vue'
import type { Component } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import {
  FORMAT_TRIGGER_CLASS,
  SEGMENT_TRIGGER_CLASS
} from '../cinematic-studio/cinematic-menu-trigger'
import CinematicMenu from '../cinematic-studio/CinematicMenu.vue'

const {
  heading,
  options,
  icon = Maximize,
  label,
  composer = false,
  disabled = false
} = defineProps<{
  heading: string
  options: readonly { id: T; label: string; detail?: string }[]
  icon?: Component
  /** Names the field above it, as a row of its own in the side panel. */
  label?: string
  /** Sits in the bottom composer as a pill, like Cinematic Studio's format pill. */
  composer?: boolean
  disabled?: boolean
}>()
const value = defineModel<T>({ required: true })

const menuOptions = computed(() =>
  options.map((option) => ({
    id: option.id,
    label: option.label,
    meta: option.detail
  }))
)
const menuValue = computed({
  get: () => value.value,
  set: (id: string) => {
    const picked = options.find((option) => option.id === id)
    if (picked) value.value = picked.id
  }
})
const selected = computed(
  () => options.find((option) => option.id === value.value)?.label ?? ''
)
</script>

<template>
  <div
    v-if="composer"
    :class="
      cn(
        'flex h-9 shrink-0 items-center overflow-hidden rounded-xl text-[13px] whitespace-nowrap ring-1 ring-transparency-white-t8 ring-inset',
        disabled && 'opacity-40'
      )
    "
  >
    <CinematicMenu
      v-model="menuValue"
      :options="menuOptions"
      :heading
      :disabled
      :trigger-class="SEGMENT_TRIGGER_CLASS"
      tooltip
    >
      <component :is="icon" class="size-3.5" aria-hidden="true" />
      {{ selected }}
    </CinematicMenu>
  </div>
  <div v-else class="flex flex-col gap-2 px-1">
    <span v-if="label" class="text-xs text-primary-warm-gray">{{ label }}</span>
    <CinematicMenu
      v-model="menuValue"
      :options="menuOptions"
      :heading
      :disabled
      side="bottom"
      tooltip
      :trigger-class="cn(FORMAT_TRIGGER_CLASS, 'disabled:opacity-40')"
      content-class="w-(--reka-dropdown-menu-trigger-width) min-w-0"
    >
      <component
        :is="icon"
        class="size-3.5 text-primary-warm-gray"
        aria-hidden="true"
      />
      <span class="flex-1 text-left">{{ selected }}</span>
      <ChevronDown class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
    </CinematicMenu>
  </div>
</template>
