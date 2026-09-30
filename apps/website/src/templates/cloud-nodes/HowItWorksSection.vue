<script setup lang="ts">
import ChecklistSplit01 from '../../components/blocks/ChecklistSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const pointNumbers = [1, 2, 3, 4] as const

const criteria = pointNumbers.map((n) => ({
  id: String(n),
  label: t(`cloudNodesLaunch.howItWorks.${n}.label`, {}, { locale: locale })
}))
</script>

<template>
  <ChecklistSplit01
    :heading="t('cloudNodesLaunch.howItWorks.heading', {}, { locale: locale })"
    :subheading="
      t('cloudNodesLaunch.howItWorks.subheading', {}, { locale: locale })
    "
    :criteria="criteria"
  />
</template>
