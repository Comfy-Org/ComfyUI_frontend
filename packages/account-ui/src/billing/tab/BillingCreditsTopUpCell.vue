<template>
  <div
    :class="
      cn('flex flex-1 items-start justify-between gap-4 px-5 py-4', rootClass)
    "
  >
    <div class="flex flex-col gap-2">
      <span class="flex items-center gap-1 text-sm text-muted-foreground">
        {{ copy.topUp }}
        <TextTooltip :text="copy.topUpTooltip">
          <CheckoutButton
            :aria-label="copy.topUpTooltip"
            variant="muted-textonly"
            size="icon-sm"
          >
            <i class="icon-[lucide--info] size-3.5" aria-hidden="true" />
          </CheckoutButton>
        </TextTooltip>
      </span>
      <span
        class="text-sm font-semibold text-foreground"
        data-testid="billing-credits-top-up"
      >
        {{ formatWholeCredits(centsToCredits(topUpCents), locale) }}
      </span>
      <span v-if="topUpInUse" class="text-xs text-muted-foreground">
        {{ copy.inUse }}
      </span>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import TextTooltip from '@comfyorg/design-system/tooltip/TextTooltip'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from '#/billing/checkout/CheckoutButton.vue'

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
