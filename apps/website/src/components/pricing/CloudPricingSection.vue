<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { externalLinks, getRoutes } from '../../config/routes'
import PricingFreeBanner from './PricingFreeBanner.vue'
import PricingSection from './PricingSection.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()
</script>

<template>
  <PricingSection
    team-invite-members-key="pricing.feature.inviteMembersUpTo50"
    enterprise-cta-key="pricing.enterprise.learnMore"
    :enterprise-cta-href="getRoutes(locale).enterprise"
    :locale
  >
    <template #banner>
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
