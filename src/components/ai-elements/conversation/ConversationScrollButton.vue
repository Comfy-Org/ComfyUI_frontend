<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

import { useConversation } from './context'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { t } = useI18n()
const { isAtBottom, scrollToBottom } = useConversation()
const label = t('agent.scrollToBottom')
</script>

<template>
  <div
    v-if="!isAtBottom"
    class="pointer-events-none sticky bottom-2 z-10 flex justify-center"
  >
    <Tooltip>
      <TooltipTrigger>
        <Button
          size="icon"
          :class="
            cn(
              'pointer-events-auto rounded-full shadow-md ring-1 ring-muted-foreground',
              className
            )
          "
          :aria-label="label"
          @click="scrollToBottom"
        >
          <i class="icon-[lucide--chevron-down] size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{{ label }}</TooltipContent>
    </Tooltip>
  </div>
</template>
