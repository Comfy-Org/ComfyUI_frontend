<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'

import type { BadgeVariants } from './badge.variants'
import { badgeVariants } from './badge.variants'

const {
  variant,
  severity,
  removable,
  removeLabel,
  class: customClass = ''
} = defineProps<
  {
    variant?: BadgeVariants['variant']
    severity?: BadgeVariants['severity']
    class?: HTMLAttributes['class']
  } & (
    | { removable: true; removeLabel: string }
    | { removable?: false; removeLabel?: string }
  )
>()

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
      :aria-label="removeLabel"
      @click="emit('remove', $event)"
    >
      <i class="icon-[lucide--x] size-3" aria-hidden="true" />
    </Button>
  </span>
</template>
