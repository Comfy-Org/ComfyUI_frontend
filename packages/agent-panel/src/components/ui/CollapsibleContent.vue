<script setup lang="ts">
import { CollapsibleContent } from 'reka-ui'

import { cn } from '@/utils/cn'

const { class: cls } = defineProps<{ class?: string }>()
</script>

<template>
  <CollapsibleContent
    :class="
      cn(
        'overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
        cls
      )
    "
  >
    <slot />
  </CollapsibleContent>
</template>
