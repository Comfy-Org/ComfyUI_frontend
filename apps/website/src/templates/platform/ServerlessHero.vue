<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { platformCtas } from './ctas'
import ServerlessVisual from './ServerlessVisual.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
</script>

<template>
  <HeroSplit01
    :locale="locale"
    compact
    :badge-text="t('platform.hero.badge', locale)"
    :title="t('platform.products.serverless.title', locale)"
    :subtitle="t('platform.products.serverless.description', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
  >
    <template #media>
      <ServerlessVisual :locale />
    </template>
  </HeroSplit01>
</template>
