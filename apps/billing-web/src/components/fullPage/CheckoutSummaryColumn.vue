<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { SummaryLedger } from '@/checkout/summaryLedger'
import CheckoutLedger from '@/components/fullPage/summary/CheckoutLedger.vue'

const {
  ledger,
  locked = false,
  repricing = false
} = defineProps<{
  ledger?: SummaryLedger
  /** Money on its way: the back arrow goes with the rest of the page. */
  locked?: boolean
  /** A promo re-quote is in flight, so the total on screen is not final. */
  repricing?: boolean
}>()

const emit = defineEmits<{ back: [] }>()

const { t } = useI18n()

const SKELETON_BAR =
  'block rounded-full bg-tertiary-background motion-safe:animate-pulse'
</script>

<template>
  <section
    class="flex bg-base-background lg:w-1/2 lg:justify-end"
    :aria-label="t('checkout.fullPage.summary.label')"
    :aria-busy="ledger === undefined || repricing"
  >
    <div class="flex w-full flex-col px-6 py-12 lg:max-w-lg lg:px-16">
      <div class="relative flex h-5 items-center">
        <button
          v-if="!locked"
          type="button"
          :aria-label="t('checkout.back')"
          class="absolute -left-10 flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary-background hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none max-lg:static max-lg:mr-2"
          @click="emit('back')"
        >
          <i class="icon-[lucide--arrow-left] size-4" aria-hidden="true" />
        </button>
        <i
          class="icon-[comfy--comfy-logo] h-5 w-18 text-brand-yellow"
          role="img"
          :aria-label="t('checkout.fullPage.logo')"
        />
      </div>

      <CheckoutLedger v-if="ledger" :ledger>
        <slot :ledger />
      </CheckoutLedger>
      <template v-else>
        <div class="mt-16 flex flex-col gap-3">
          <span class="sr-only">{{ t('hosted.loading') }}</span>
          <span :class="cn(SKELETON_BAR, 'h-3 w-2/3')" />
          <span :class="cn(SKELETON_BAR, 'h-4 w-2/3')" />
        </div>
        <div
          class="mt-8 flex items-center justify-between gap-4 border-t border-border-default pt-6"
        >
          <span class="text-base font-semibold text-base-foreground">
            {{ t('checkout.totalDueToday') }}
          </span>
          <span :class="cn(SKELETON_BAR, 'h-3 w-16')" />
        </div>
      </template>
    </div>
  </section>
</template>
