<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

import Button from '@/components/ui/button/Button.vue'

import type { BadgeVariants } from './badge.variants'
import { badgeVariants } from './badge.variants'

const {
  variant,
  severity,
  removable = false,
  removeLabel,
  class: customClass = ''
} = defineProps<{
  variant?: BadgeVariants['variant']
  severity?: BadgeVariants['severity']
  removable?: boolean
  removeLabel?: string
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{ remove: [event: MouseEvent] }>()
</script>

<template>
  <span :class="cn(badgeVariants({ variant, severity }), customClass)">
    <slot name="icon" />
    <slot />
    <Button
      v-if="removable"
      type="button"
      variant="textonly"
      size="icon-sm"
      class="-mr-1 rounded-full text-current"
      :aria-label="removeLabel ?? $t('g.remove')"
      @click="emit('remove', $event)"
    >
      <i class="icon-[lucide--x] size-3" aria-hidden="true" />
    </Button>
  </span>
</template>
