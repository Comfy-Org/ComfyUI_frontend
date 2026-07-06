<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { Clock } from '@lucide/vue'

import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'
import PricingCard from './PricingCard.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()
</script>

<template>
  <PricingCard class="col-span-full">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
      <span
        class="text-primary-warm-gray inline-flex shrink-0 items-center gap-2 text-sm tracking-wider uppercase"
      >
        <Clock class="size-4" />
        {{ t('pricing.studentAmbassador.comingSoon', locale) }}
      </span>

      <span
        class="text-primary-warm-white shrink-0 text-base font-bold tracking-wider uppercase"
      >
        {{ t('pricing.studentAmbassador.label', locale) }}
      </span>

      <p class="text-primary-warm-white flex-1 text-sm">
        {{ t('pricing.studentAmbassador.description', locale) }}
      </p>

      <a
        :href="externalLinks.studentAmbassadorForm"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-comfy-yellow inline-flex shrink-0 items-center gap-3 text-sm font-bold tracking-wider uppercase"
      >
        <span class="underline underline-offset-4">
          {{ t('pricing.studentAmbassador.cta', locale) }}
        </span>
        <span
          class="border-primary-comfy-yellow/50 hidden w-12 border-t border-dashed lg:block"
          aria-hidden="true"
        />
      </a>
    </div>
  </PricingCard>
</template>
