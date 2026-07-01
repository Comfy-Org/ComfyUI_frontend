<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

const { tooltip, pressed = false } = defineProps<{
  tooltip: string
  pressed?: boolean
}>()

const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <Tooltip :delay-duration="500">
    <TooltipTrigger>
      <button
        type="button"
        :aria-label="tooltip"
        :aria-pressed="pressed"
        :class="
          pressed
            ? 'text-base-foreground'
            : 'text-muted-foreground hover:text-base-foreground'
        "
        class="flex cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-1 transition-colors hover:bg-secondary-background-hover"
        @click="emit('click')"
      >
        <slot />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" class="whitespace-nowrap">{{
      tooltip
    }}</TooltipContent>
  </Tooltip>
</template>
