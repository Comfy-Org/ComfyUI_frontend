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
    :title="t('platform.builderHero.heading', locale)"
    title-class="text-primary-comfy-yellow text-3xl/tight font-bold tracking-[-1.44px] md:text-4xl/tight lg:text-5xl/tight"
    :subtitle="t('platform.builderHero.subtitle', locale)"
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
