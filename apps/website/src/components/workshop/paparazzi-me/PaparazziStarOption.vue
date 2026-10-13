<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { initialsOf } from '@/lib/workshop/initials'

const { name, roleLabel, active, selected } = defineProps<{
  name: string
  roleLabel: string
  active: boolean
  selected: boolean
}>()

const emit = defineEmits<{ pick: [] }>()
</script>

<template>
  <li
    role="option"
    :aria-selected="selected"
    :class="
      cn(
        'flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 transition hover:bg-transparency-white-t4',
        active && 'bg-transparency-white-t8 hover:bg-transparency-white-t8'
      )
    "
    @mousedown.prevent
    @click="emit('pick')"
  >
    <span
      :class="
        cn(
          'grid size-7 shrink-0 place-items-center rounded-full bg-linear-to-br from-secondary-mauve to-primary-comfy-plum text-[10px] font-semibold text-primary-warm-white',
          selected && 'ring-2 ring-primary-warm-white'
        )
      "
      aria-hidden="true"
      >{{ initialsOf(name) }}</span
    >
    <span class="flex min-w-0 flex-col">
      <span class="truncate text-xs text-primary-warm-white">{{ name }}</span>
      <span class="truncate text-[11px] text-primary-warm-gray">{{
        roleLabel
      }}</span>
    </span>
  </li>
</template>
