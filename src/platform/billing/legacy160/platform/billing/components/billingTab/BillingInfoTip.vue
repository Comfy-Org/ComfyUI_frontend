<template>
  <Tooltip open-on-click>
    <TooltipTrigger as-child>
      <Button
        :aria-label="label ?? text"
        variant="muted-textonly"
        size="icon-sm"
        class="cursor-help hover:bg-transparent"
      >
        <i class="icon-[lucide--info] size-3.5" aria-hidden="true" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{ text }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'

const { text, label } = defineProps<{
  text: string
  label?: string
}>()
</script>
