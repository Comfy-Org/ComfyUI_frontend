<script setup lang="ts">
import StepsGrid01 from '../../components/blocks/StepsGrid01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const stepNumbers = [1, 2, 3] as const

const steps = stepNumbers.map((n) => ({
  id: String(n),
  label: t(`cloudNodesLaunch.setup.step${n}.label`, locale),
  description: t(`cloudNodesLaunch.setup.step${n}.description`, locale)
}))
</script>

<template>
  <section id="setup" class="scroll-mt-24">
    <StepsGrid01
      :heading="t('cloudNodesLaunch.setup.heading', locale)"
      :steps="steps"
    />
  </section>
</template>
