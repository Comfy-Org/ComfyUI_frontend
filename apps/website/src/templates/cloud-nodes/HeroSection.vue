<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { cloudNodesCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = cloudNodesCtas(locale)

const HERO_VIDEO = 'https://media.comfy.org/website/cloud-nodes/hero_v1.mp4'
const HERO_POSTER =
  'https://media.comfy.org/website/cloud-nodes/hero-poster_v1.webp'

const featureNumbers = [1, 2, 3] as const
const features = featureNumbers.map((n) =>
  t(`cloudNodesLaunch.hero.feature${n}`, locale)
)
</script>

<template>
  <HeroSplit01
    :locale="locale"
    class="min-h-[calc(100svh-5rem)] lg:min-h-[calc(100svh-6.75rem)]"
    badge-text="CLOUD NODES"
    beta
    :title="t('cloudNodesLaunch.hero.title', locale)"
    :title-highlight="t('cloudNodesLaunch.hero.titleHighlight', locale)"
    :subtitle="t('cloudNodesLaunch.hero.subtitle', locale)"
    :features="features"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
    :video-src="HERO_VIDEO"
    :video-poster="HERO_POSTER"
    :video-aria-label="t('cloudNodesLaunch.hero.videoAlt', locale)"
    video-autoplay
    video-loop
    video-minimal
  />
</template>
