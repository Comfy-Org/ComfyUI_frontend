<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { cloudNodesCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = cloudNodesCtas(locale)

const featureNumbers = [1, 2, 3] as const
const features = featureNumbers.map((n) =>
  t(`cloudNodesLaunch.hero.feature${n}`, locale)
)
</script>

<template>
  <!-- 5rem/6.75rem = HeaderMain's rendered height (py-5 / lg:py-8) so the hero fills the viewport below the sticky nav -->
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
    video-src="https://media.comfy.org/website/cloud-nodes/nodegraph-crisp.mp4"
    video-poster="https://media.comfy.org/website/cloud-nodes/hero-poster_v1.webp"
    :video-aria-label="t('cloudNodesLaunch.hero.videoAlt', locale)"
    video-autoplay
    video-loop
    video-minimal
    video-hide-controls
  />
</template>
