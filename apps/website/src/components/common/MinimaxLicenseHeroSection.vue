<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchHero } from '../../templates/model-launch/types'

import { localizeHref } from '../../config/routes'
import { minimaxLinks } from '../../data/minimax'
import ModelLaunchHeroSection from '../../templates/model-launch/ModelLaunchHeroSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const hero = {
  layout: 'overlay',
  videoSrc: 'https://media.comfy.org/website/minimax/commercial-license.mp4',
  posterSrc:
    'https://media.comfy.org/website/minimax/commercial-license-poster.jpg',
  mobileFallbackImageSrc:
    'https://media.comfy.org/website/minimax/commercial-license-poster.jpg',
  titleKey: 'minimaxLicense.hero.title',
  descriptionKey: 'minimaxLicense.hero.description',
  primaryCta: {
    labelKey: 'minimaxLicense.hero.primaryCta',
    href: localizeHref('/contact', locale)
  },
  secondaryCta: {
    labelKey: 'minimaxLicense.hero.secondaryCta',
    href: minimaxLinks.cloudRun,
    target: '_blank'
  },
  badgeKeys: [
    'minimaxLicense.hero.tagOfficialReseller',
    'minimaxLicense.hero.tagAudioMusic',
    'minimaxLicense.hero.tagGlobal'
  ]
} satisfies ModelLaunchHero
</script>

<template>
  <ModelLaunchHeroSection :hero :locale heading-tag="h2" />
</template>
