<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import ChecklistSplit01 from '../../components/blocks/ChecklistSplit01.vue'
import { affiliateAudienceCriteria } from '../../data/affiliateAudience'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const criteria = affiliateAudienceCriteria.map((criterion) => ({
  id: criterion.id,
  label: criterion.label[locale]
}))
</script>

<template>
  <ChecklistSplit01
    :heading="t('affiliate.audience.heading', locale)"
    :subheading="t('affiliate.audience.subheading', locale)"
    :criteria="criteria"
  />
</template>
