<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import BasePricingSection from '../../components/pricing/PricingSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<!-- The pricing section stays on the ink palette inside the subbrand light
     page, so the dark background is explicit rather than inherited. -->
<template>
  <div class="bg-primary-comfy-ink">
    <BasePricingSection
      :locale
      heading-level="h2"
      title-key="developers.pricing.title"
      subtitle-key="developers.pricing.lead"
      default-billing-cycle="monthly"
    />
  </div>
</template>
