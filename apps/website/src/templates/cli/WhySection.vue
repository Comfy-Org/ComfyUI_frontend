<script setup lang="ts">
import ReasonsSplit01 from '../../components/blocks/ReasonsSplit01.vue'
import type { Reason } from '../../components/blocks/ReasonsSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasonNumbers = [1, 2, 3, 4, 5] as const

const reasons: Reason[] = reasonNumbers.map((n) => ({
  id: String(n),
  title: t(`cli.why.${n}.title`, locale),
  description: t(`cli.why.${n}.description`, locale)
}))
</script>

<template>
  <ReasonsSplit01
    :heading="t('cli.why.heading', locale)"
    :heading-highlight="t('cli.why.headingHighlight', locale)"
    highlight-class="text-primary-comfy-yellow"
    :subtitle="t('cli.why.subtitle', locale)"
    :reasons="reasons"
  />
</template>
