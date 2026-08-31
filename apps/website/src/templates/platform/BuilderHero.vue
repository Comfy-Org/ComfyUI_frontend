<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import BuilderVisual from './BuilderVisual.vue'
import { platformCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
</script>

<template>
  <HeroSplit01
    :locale="locale"
    compact
    beta
    :badge-text="t('platform.hero.badge', locale)"
    :title="t('platform.products.builder.title', locale)"
    :subtitle="t('platform.products.builder.description', locale)"
    :primary-cta="{
      label: ctas.getStarted.label,
      href: externalLinks.platformBuilds,
      target: '_blank'
    }"
    :secondary-cta="{
      label: ctas.docs.label,
      href: ctas.docs.href,
      target: ctas.docs.target
    }"
  >
    <template #media>
      <BuilderVisual />
    </template>
  </HeroSplit01>
</template>
