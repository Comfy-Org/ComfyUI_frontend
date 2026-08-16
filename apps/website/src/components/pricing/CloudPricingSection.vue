<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { SHOW_FREE_TIER } from '../../config/features'
import { externalLinks } from '../../config/routes'
import PricingFreeBanner from './PricingFreeBanner.vue'
import PricingSection from './PricingSection.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()
</script>

<template>
  <PricingSection :locale>
    <template v-if="SHOW_FREE_TIER" #banner>
      <PricingFreeBanner
        title-key="pricing.banner.title"
        subtitle-key="pricing.banner.subtitle"
        :cta="{
          labelKey: 'pricing.banner.cta',
          href: externalLinks.cloud,
          target: '_blank'
        }"
        :locale
      />
    </template>
  </PricingSection>
</template>
