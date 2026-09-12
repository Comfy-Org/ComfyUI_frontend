<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'

import type { BadgeVariants } from './badge.variants'
import { badgeVariants } from './badge.variants'

const {
  value,
  variant,
  severity,
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
    <Button
      v-if="removable"
      type="button"
      variant="textonly"
      size="icon-sm"
      class="-mr-1 rounded-full text-current"
      :aria-label="t('g.remove')"
      @click="emit('remove', $event)"
    >
      <i class="icon-[lucide--x] size-3" aria-hidden="true" />
    </Button>
  </span>
</template>
