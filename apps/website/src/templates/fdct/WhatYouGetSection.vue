<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import ChecklistSplit01 from '../../components/blocks/ChecklistSplit01.vue'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const criteria = (['item1', 'item2', 'item3', 'item4', 'item5'] as const).map(
  (item) => ({
    id: item,
    label: t(`fdct.whatYouGet.${item}`)
  })
)
</script>

<template>
  <ChecklistSplit01
    :subheading="t('fdct.whatYouGet.title')"
    :criteria="criteria"
  />
</template>
