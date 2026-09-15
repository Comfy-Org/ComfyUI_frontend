<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { platformCtas } from './ctas'
import PlatformHeroBadge from './PlatformHeroBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
</script>

<template>
  <div class="relative">
    <HeroSplit01
      :locale="locale"
      compact
      beta
      class="relative z-10 pt-12 pb-10 md:pt-16 md:pb-14"
      :badge-text="t('platform.hero.badge', locale)"
      :badge-show-logo="false"
      :title="t('platform.hero.heading', locale)"
      title-class="sr-only"
      :subtitle="t('platform.hero.subtitle', locale)"
      subtitle-class="mt-6 max-w-md whitespace-pre-line text-sm leading-relaxed"
      cta-wrapper-class="mt-6"
      :primary-cta="ctas.getStarted"
      :secondary-cta="ctas.docs"
    >
      <template #badge>
        <PlatformHeroBadge :locale="locale" />
      </template>
    </HeroSplit01>
  </div>
</template>
