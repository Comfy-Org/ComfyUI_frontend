<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import ChecklistSplit01 from '../../components/blocks/ChecklistSplit01.vue'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const criteria = (['item1', 'item2', 'item3', 'item4', 'item5'] as const).map(
  (item) => ({
    id: item,
    label: t(`fdct.whatYouGet.${item}`, locale)
  })
)
</script>

<template>
  <ChecklistSplit01
    :subheading="t('fdct.whatYouGet.title', locale)"
    :criteria="criteria"
  />
</template>
