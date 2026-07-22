<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import HeroBackdrop01 from '../../components/blocks/HeroBackdrop01.vue'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const backdropSrc = 'https://media.comfy.org/website/edu/edu_hero.mp4'
const mobileBackdropSrc =
  'https://media.comfy.org/website/edu/edu_hero-mobile.mp4'
const backdropPoster =
  'https://media.comfy.org/website/edu/edu_hero_thumbnail.png'
</script>

<template>
  <HeroBackdrop01
    :backdrop="{
      type: 'video',
      src: backdropSrc,
      poster: backdropPoster,
      alt: t('education.hero.backdropAlt', locale)
    }"
    :mobile-backdrop="{
      type: 'video',
      src: mobileBackdropSrc,
      poster: backdropPoster,
      alt: t('education.hero.backdropAlt', locale)
    }"
    :badge-text="t('education.hero.badge', locale)"
    :title="t('education.hero.title', locale)"
    :subtitle="t('education.hero.subtitle', locale)"
    :footnote="t('education.hero.footnote', locale)"
  />
</template>
