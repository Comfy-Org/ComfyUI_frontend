<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { Clock } from '@lucide/vue'

import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'
import Button from '../ui/button/Button.vue'
import PricingCard from './PricingCard.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()
</script>

<template>
  <PricingCard class="col-span-full max-lg:mx-auto max-lg:max-w-lg lg:py-3">
    <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
      <span
        class="text-primary-warm-gray inline-flex shrink-0 items-center gap-2 text-base tracking-wider uppercase"
      >
        <Clock class="size-5" />
        <span class="ppformula-text-center">
          {{ t('pricing.studentAmbassador.comingSoon', locale) }}
        </span>
      </span>

      <span
        class="ppformula-text-center shrink-0 text-base font-bold tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ t('pricing.studentAmbassador.label', locale) }}
      </span>

      <p class="text-primary-warm-white ppformula-text-center flex-1 text-base">
        {{ t('pricing.studentAmbassador.description', locale) }}
      </p>

      <Button
        :href="externalLinks.studentAmbassadorForm"
        target="_blank"
        rel="noopener noreferrer"
        variant="underlineLink"
        class="shrink-0"
      >
        {{ t('pricing.studentAmbassador.cta', locale) }}
      </Button>
    </div>
  </PricingCard>
</template>
