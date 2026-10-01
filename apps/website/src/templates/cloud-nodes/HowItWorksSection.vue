<script setup lang="ts">
import ChecklistSplit01 from '../../components/blocks/ChecklistSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const pointNumbers = [1, 2, 3, 4] as const

const criteria = pointNumbers.map((n) => ({
  id: String(n),
  label: t(`cloudNodesLaunch.howItWorks.${n}.label`)
}))
</script>

<template>
  <ChecklistSplit01
    :heading="t('cloudNodesLaunch.howItWorks.heading')"
    :subheading="t('cloudNodesLaunch.howItWorks.subheading')"
    :criteria="criteria"
  />
</template>
