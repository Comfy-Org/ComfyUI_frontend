<script setup lang="ts">
import ReasonsSplit01 from '@/components/blocks/ReasonsSplit01.vue'
import type { Reason } from '@/components/blocks/ReasonsSplit01.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const reasonNumbers = [1, 2, 3, 4] as const

const reasons: Reason[] = reasonNumbers.map((n) => ({
  id: String(n),
  title: t(`cloudNodesLaunch.why.${n}.title`),
  description: t(`cloudNodesLaunch.why.${n}.description`)
}))
</script>

<template>
  <ReasonsSplit01
    :heading="t('cloudNodesLaunch.why.heading')"
    :heading-highlight="t('cloudNodesLaunch.why.headingHighlight')"
    :subtitle="t('cloudNodesLaunch.why.subtitle')"
    :reasons="reasons"
  />
</template>
