<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { platformCtas } from './ctas'
import DeployTerminal from './DeployTerminal.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
</script>

<template>
  <HeroSplit01
    :locale="locale"
    compact
    class="pt-12 pb-10 md:pt-16 md:pb-14"
    :title="t('platform.hero.heading', locale)"
    title-class="text-3xl md:text-4xl lg:text-5xl"
    cta-class="px-7 py-3.5 text-base"
    :subtitle="t('platform.hero.subtitle', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
  >
    <template #belowCtas>
      <p class="text-primary-warm-gray mt-5 max-w-xl text-xs">
        {{ t('platform.faq.betaBanner', locale) }}
      </p>
    </template>

    <template #media>
      <DeployTerminal />
    </template>
  </HeroSplit01>
</template>
