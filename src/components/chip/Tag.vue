<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { tagVariants } from './tag.variants'
import type { TagVariants } from './tag.variants'

const {
  label,
  shape = 'square',
  state = 'default',
  removable = false,
  class: className
} = defineProps<{
  label: string
  shape?: TagVariants['shape']
  state?: TagVariants['state']
  removable?: boolean
  class?: string
}>()

const emit = defineEmits<{
  remove: [event: Event]
}>()

const tagClass = computed(() =>
  cn(tagVariants({ shape, state, removable }), className)
)
</script>

<template>
  <span :class="tagClass">
    <slot name="icon" />
    <span class="truncate">{{ label }}</span>
    <button
      v-if="removable"
      type="button"
      :aria-label="$t('g.remove')"
      class="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full p-0.5 hover:bg-white/10"
      @click="emit('remove', $event)"
    >
      <i class="icon-[lucide--x] size-3" aria-hidden="true" />
    </button>
  </span>
</template>
