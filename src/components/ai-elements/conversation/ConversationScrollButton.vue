<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

import Button from '@/components/ui/button/Button.vue'

import { useConversation } from './context'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { isAtBottom, scrollToBottom } = useConversation()
</script>

<template>
  <Button
    v-if="!isAtBottom"
    variant="secondary"
    size="icon"
    :class="
      cn(
        'absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full shadow-md',
        className
      )
    "
    :aria-label="$t('agent.scrollToBottom')"
    @click="scrollToBottom"
  >
    <i class="icon-[lucide--chevron-down] size-4" />
  </Button>
</template>
