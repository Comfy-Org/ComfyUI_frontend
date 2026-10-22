<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'

const {
  loading = false,
  disabled = false,
  class: className
} = defineProps<{
  loading?: boolean
  disabled?: boolean
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <Button
    variant="muted-textonly"
    size="icon-sm"
    :loading
    :disabled
    :class="cn('text-muted-foreground hover:text-foreground', className)"
    :tooltip="$t('agent.enhancePrompt')"
    :aria-label="
      loading ? $t('agent.enhancingPrompt') : $t('agent.enhancePrompt')
    "
    @click="emit('click', $event)"
  >
    <i class="icon-[lucide--astroid] size-3" />
  </Button>
</template>
