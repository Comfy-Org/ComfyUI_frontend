<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import CodeTabs from './CodeTabs.vue'
import { modelsApiCodeTabs } from './codeSamples'
import { platformCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
</script>

<template>
  <HeroSplit01
    :locale="locale"
    compact
    :badge-text="t('platform.hero.badge', locale)"
    :badge-show-logo="false"
    :title="t('platform.products.models.title', locale)"
    :subtitle="t('platform.products.models.description', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
  >
    <template #media>
      <CodeTabs
        :tabs="modelsApiCodeTabs"
        :aria-label="t('platform.products.models.title', locale)"
      />
    </template>
  </HeroSplit01>
</template>
