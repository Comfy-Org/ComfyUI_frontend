<template>
  <p
    v-for="line in lines"
    :key="line.text"
    :class="
      cn('m-0 flex items-center gap-1 text-sm text-muted-foreground', lineClass)
    "
    data-testid="billing-auto-top-up-line"
  >
    {{ line.text }}
    <BillingInfoTip v-if="line.tooltip" :text="line.tooltip" />
  </p>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import BillingInfoTip from './BillingInfoTip.vue'
import type { AutoTopUpLine } from './autoTopUpCardView'

const { lines, lineClass } = defineProps<{
  lines: readonly AutoTopUpLine[]
  lineClass?: string
}>()
</script>
