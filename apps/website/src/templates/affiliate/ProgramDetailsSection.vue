<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import DetailsTable01 from '../../components/blocks/DetailsTable01.vue'
import { affiliateProgramDetails } from '../../data/affiliateProgramDetails'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const rows = affiliateProgramDetails.map((row) => ({
  id: row.id,
  label: row.label[locale],
  value: row.value[locale]
}))
</script>

<template>
  <DetailsTable01
    :heading="t('affiliate.details.heading', locale)"
    :header-label="t('affiliate.details.headerLabel', locale)"
    :header-value="t('affiliate.details.headerValue', locale)"
    :rows="rows"
  />
</template>
