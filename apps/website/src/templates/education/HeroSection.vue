<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import HeroBackdrop01 from '../../components/blocks/HeroBackdrop01.vue'
import { t } from '../../i18n/translations'
import {
  eduHeroBackdropSrc as backdropSrc,
  eduHeroMobileBackdropSrc as mobileBackdropSrc,
  eduHeroPoster as backdropPoster
} from './heroAssets'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
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
