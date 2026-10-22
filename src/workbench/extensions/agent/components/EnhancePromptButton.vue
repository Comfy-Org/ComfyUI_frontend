<script setup lang="ts">
import type { TooltipContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'

const {
  loading = false,
  disabled = false,
  class: className,
  tooltipSide,
  size = 'icon-sm'
} = defineProps<{
  loading?: boolean
  disabled?: boolean
  class?: HTMLAttributes['class']
  tooltipSide?: TooltipContentProps['side']
  size?: 'icon-sm' | 'icon'
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <Button
    variant="muted-textonly"
    :size
    :loading
    :disabled
    :class="className"
    :tooltip="$t('agent.enhancePrompt')"
    :tooltip-side="tooltipSide"
    :aria-label="
      loading ? $t('agent.enhancingPrompt') : $t('agent.enhancePrompt')
    "
    @click="emit('click', $event)"
  >
    <i
      :class="
        cn('icon-[lucide--astroid]', size === 'icon' ? 'size-4' : 'size-3')
      "
    />
  </Button>
</template>
