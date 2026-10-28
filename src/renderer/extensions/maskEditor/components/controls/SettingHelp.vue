<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <span
        tabindex="0"
        class="cursor-help rounded-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      >
        <slot />
      </span>
    </TooltipTrigger>
    <TooltipContent side="left" :side-offset="8" class="max-w-56">
      {{ text }}
    </TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'

defineProps<{
  text: string
}>()
</script>
