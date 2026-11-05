<template>
  <div :class="cn('flex flex-1 flex-col gap-2 px-5 py-4', rootClass)">
    <div class="flex items-center justify-between gap-4">
      <div class="flex flex-col gap-2">
        <span class="flex items-center gap-1 text-sm text-muted-foreground">
          {{ copy.topUp }}
          <BillingInfoTip :text="copy.topUpTooltip" />
        </span>
        <span
          class="text-sm font-semibold text-foreground"
          data-testid="billing-credits-top-up"
        >
          {{ formatWholeCredits(centsToCredits(topUpCents), locale) }}
        </span>
      </div>
      <slot />
    </div>
    <span v-if="topUpInUse" class="text-xs text-muted-foreground">
      {{ copy.inUse }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import BillingInfoTip from './BillingInfoTip.vue'
import { centsToCredits, formatWholeCredits } from './creditsCardCopy'
import type { CreditsCardCopy } from './creditsCardCopy'

const { topUpCents, topUpInUse, copy, locale, rootClass } = defineProps<{
  topUpCents: number
  topUpInUse: boolean
  copy: CreditsCardCopy
  locale: string
  rootClass?: string
}>()
</script>
