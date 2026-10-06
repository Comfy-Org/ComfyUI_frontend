<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import HeroSplit01 from '@/components/blocks/HeroSplit01.vue'
import { localizeHref } from '@/config/routes'
import { getTutorialByCategoryAndSlug } from '@/data/learningTutorials'
import { vfxPage } from '@/data/vfx'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const tutorial = getTutorialByCategoryAndSlug(
  vfxPage.heroTutorial.category,
  vfxPage.heroTutorial.slug
)
const video = tutorial?.videoSrc
  ? {
      src: tutorial.videoSrc,
      poster: tutorial.poster,
      tracks: tutorial.caption ? [...tutorial.caption] : []
    }
  : undefined
</script>

<template>
  <HeroSplit01
    :locale
    :badge-text="t('vfx.hero.eyebrow')"
    :title="t('vfx.hero.title')"
    :subtitle="t('vfx.hero.subtitle')"
    :primary-cta="{
      label: t('vfx.hero.cta'),
      href: localizeHref(vfxPage.contactHref, locale)
    }"
    :video-src="video?.src"
    :video-poster="video?.poster"
    :video-tracks="video?.tracks"
    :video-aria-label="t('vfx.hero.videoLabel')"
  />
</template>
