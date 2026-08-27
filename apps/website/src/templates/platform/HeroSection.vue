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
    :badge-text="t('platform.hero.badge', locale)"
    :title="t('platform.hero.heading', locale)"
    :subtitle="t('platform.hero.subtitle', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
  >
    <template #media>
      <DeployTerminal />
    </template>
  </HeroSplit01>
</template>
