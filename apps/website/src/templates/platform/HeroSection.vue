<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { platformCtas } from './ctas'
import DeployTerminal from './DeployTerminal.vue'
import PlatformHeroShader from './PlatformHeroShader.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
</script>

<template>
  <div class="relative isolate overflow-hidden">
    <PlatformHeroShader />
    <div
      class="pointer-events-none absolute inset-0 z-0 bg-linear-to-r from-primary-comfy-ink via-primary-comfy-ink/45 to-transparent"
    />
    <HeroSplit01
      :locale="locale"
      compact
      class="relative z-10 pt-12 pb-10 md:pt-16 md:pb-14"
      :badge-text="t('platform.hero.badge', locale)"
      :badge-show-logo="false"
      :title="t('platform.hero.heading', locale)"
      title-class="sr-only"
      :subtitle="t('platform.hero.subtitle', locale)"
      subtitle-class="mt-6 max-w-md text-sm leading-relaxed"
      cta-wrapper-class="mt-6"
      :primary-cta="ctas.getStarted"
      :secondary-cta="ctas.docs"
    >
      <template #belowCtas>
        <p class="mt-5 max-w-md text-xs text-primary-warm-gray">
          {{ t('platform.faq.betaBanner', locale) }}
        </p>
      </template>

      <template #media>
        <DeployTerminal />
      </template>
    </HeroSplit01>
  </div>
</template>
