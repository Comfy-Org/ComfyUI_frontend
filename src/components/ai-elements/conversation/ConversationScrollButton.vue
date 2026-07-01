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
  <div
    v-if="!isAtBottom"
    class="pointer-events-none sticky bottom-2 z-10 flex justify-center"
  >
    <Button
      variant="secondary"
      size="icon"
      :class="cn('pointer-events-auto rounded-full shadow-md', className)"
      :aria-label="$t('agent.scrollToBottom')"
      @click="scrollToBottom"
    >
      <i class="icon-[lucide--chevron-down] size-4" />
    </Button>
  </div>
</template>
