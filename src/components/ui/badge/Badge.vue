<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { BadgeVariants } from './badge.variants'
import { badgeVariants } from './badge.variants'

const {
  value,
  variant = 'tag',
  severity = 'secondary',
  removable = false,
  class: customClass = ''
} = defineProps<{
  value?: string | number
  variant?: BadgeVariants['variant']
  severity?: BadgeVariants['severity']
  removable?: boolean
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{ remove: [event: MouseEvent] }>()
const { t } = useI18n()
</script>

<template>
  <span :class="cn(badgeVariants({ variant, severity }), customClass)">
    <slot name="icon" />
    <slot>{{ value }}</slot>
    <button
      v-if="removable"
      type="button"
      class="-mr-1 flex size-5 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-current hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
      :aria-label="t('g.remove')"
      @click="emit('remove', $event)"
    >
      <i class="icon-[lucide--x] size-3" aria-hidden="true" />
    </button>
  </span>
</template>
