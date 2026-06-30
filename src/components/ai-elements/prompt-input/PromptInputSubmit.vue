<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { ButtonVariants } from '@/components/ui/button/button.variants'

import type { ChatStatus } from './types'

const {
  class: className,
  status = 'ready',
  variant = 'inverted',
  size = 'icon',
  disabled = false
} = defineProps<{
  class?: HTMLAttributes['class']
  status?: ChatStatus
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  disabled?: boolean
}>()

const iconClass = computed(() => {
  switch (status) {
    case 'submitted':
      return 'icon-[lucide--loader-circle] size-4 animate-spin'
    case 'streaming':
      return 'icon-[lucide--square] size-4'
    case 'error':
      return 'icon-[lucide--x] size-4'
    default:
      return 'icon-[lucide--arrow-up] size-4'
  }
})
</script>

<template>
  <Button
    type="submit"
    :variant="variant"
    :size="size"
    :disabled="disabled"
    :class="cn('rounded-xl', className)"
    :aria-label="$t('agent.send')"
  >
    <slot>
      <i :class="iconClass" />
    </slot>
  </Button>
</template>
