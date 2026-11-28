<template>
  <Tooltip open-on-click>
    <TooltipTrigger as-child>
      <CheckoutButton
        :aria-label="label ?? text"
        variant="muted-textonly"
        size="icon-sm"
        class="cursor-help hover:bg-transparent"
      >
        <i class="icon-[lucide--info] size-3.5" aria-hidden="true" />
      </CheckoutButton>
    </TooltipTrigger>
    <TooltipContent>{{ text }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'

import CheckoutButton from '#/billing/checkout/CheckoutButton.vue'

const { text, label } = defineProps<{
  text: string
  label?: string
}>()
</script>
