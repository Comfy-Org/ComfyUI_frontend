<script setup lang="ts">
import ReasonsSplit01 from '../../components/blocks/ReasonsSplit01.vue'
import type { Reason } from '../../components/blocks/ReasonsSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasonNumbers = [1, 2, 3, 4] as const

const reasons: Reason[] = reasonNumbers.map((n) => ({
  id: String(n),
  title: t(`mcp.why.${n}.title`, locale),
  description: t(`mcp.why.${n}.description`, locale)
}))
</script>

<template>
  <ReasonsSplit01
    :heading="t('mcp.why.heading', locale)"
    :heading-highlight="t('mcp.why.headingHighlight', locale)"
    highlight-class="text-primary-comfy-yellow"
    :subtitle="t('mcp.why.subtitle', locale)"
    :reasons="reasons"
  />
</template>
