<script setup lang="ts">
import BenefitsGrid01 from '../../components/blocks/BenefitsGrid01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { cloudNodesCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = cloudNodesCtas(locale)

const stepNumbers = [1, 2, 3, 4] as const

const steps = stepNumbers.map((n) => ({
  id: String(n),
  title: t(`cloudNodesLaunch.setup.step${n}.label`, locale),
  description: t(`cloudNodesLaunch.setup.step${n}.description`, locale)
}))
</script>

<template>
  <section id="setup" class="scroll-mt-24">
    <BenefitsGrid01
      :heading="t('cloudNodesLaunch.setup.heading', locale)"
      :benefits="steps"
      :primary-cta="ctas.update"
    />
  </section>
</template>
