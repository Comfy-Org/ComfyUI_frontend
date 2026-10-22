<script setup lang="ts">
import type { TooltipContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import Button from '@/components/ui/button/Button.vue'

const {
  loading = false,
  disabled = false,
  class: className,
  tooltipSide
} = defineProps<{
  loading?: boolean
  disabled?: boolean
  class?: HTMLAttributes['class']
  tooltipSide?: TooltipContentProps['side']
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <Button
    variant="muted-textonly"
    size="icon"
    icon="icon-[lucide--astroid]"
    :loading
    :disabled
    :class="className"
    :tooltip="$t('agent.enhancePrompt')"
    :tooltip-side="tooltipSide"
    :aria-label="
      loading ? $t('agent.enhancingPrompt') : $t('agent.enhancePrompt')
    "
    @click="emit('click', $event)"
  />
</template>
