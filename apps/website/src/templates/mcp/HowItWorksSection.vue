<script setup lang="ts">
import FeatureGrid02 from '../../components/blocks/FeatureGrid02.vue'
import type { FeatureStep } from '../../components/blocks/FeatureGrid02.vue'
import type { Locale } from '../../i18n/site'
import { t } from '../../i18n/site'
import { mcpCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = mcpCtas(locale)

const stepNumbers = [1, 2, 3] as const

const steps: FeatureStep[] = stepNumbers.map((n) => ({
  id: String(n),
  number: t(`mcp.howItWorks.step${n}.number`, {}, { locale: locale }),
  title: t(`mcp.howItWorks.step${n}.title`, {}, { locale: locale }),
  description: t(`mcp.howItWorks.step${n}.description`, {}, { locale: locale })
}))
</script>

<template>
  <FeatureGrid02
    :heading="t('mcp.howItWorks.heading', {}, { locale: locale })"
    :steps="steps"
    :primary-cta="ctas.installMcp"
    :secondary-cta="ctas.docs"
  />
</template>
