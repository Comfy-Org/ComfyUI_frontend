<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import ChecklistSplit01 from '@/components/blocks/ChecklistSplit01.vue'
import { affiliateAudienceCriteria } from '@/data/affiliateAudience'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const criteria = affiliateAudienceCriteria.map((criterion) => ({
  id: criterion.id,
  label: criterion.label[locale] || criterion.label.en
}))
</script>

<template>
  <ChecklistSplit01
    :heading="t('affiliate.audience.heading')"
    :subheading="t('affiliate.audience.subheading')"
    :criteria="criteria"
  />
</template>
