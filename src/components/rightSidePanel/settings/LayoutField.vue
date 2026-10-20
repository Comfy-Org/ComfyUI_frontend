<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

import { cn } from '@comfyorg/tailwind-utils'

defineProps<{
  label: string
  tooltip?: string
  singleline?: boolean
}>()
</script>

<template>
  <div
    :class="
      cn('flex gap-2', singleline ? 'items-center justify-between' : 'flex-col')
    "
  >
    <Tooltip :disabled="!tooltip">
      <TooltipTrigger as-child>
        <span
          :class="
            cn(
              'group truncate text-sm text-muted-foreground',
              tooltip ? 'cursor-help' : '',
              singleline ? 'flex-1' : ''
            )
          "
        >
          {{ label }}

          <i
            v-if="tooltip"
            class="relative top-px ml-0.5 icon-[lucide--info] size-3 group-hover:text-primary"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">{{ tooltip }}</TooltipContent>
    </Tooltip>
    <slot />
  </div>
</template>
