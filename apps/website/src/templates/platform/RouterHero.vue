<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import CodeTabs from './CodeTabs.vue'
import { routerCodeTabs } from './codeSamples'
import { platformCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
</script>

<template>
  <HeroSplit01
    :locale="locale"
    compact
    :badge-text="t('platform.hero.badge', locale)"
    :title="t('platform.products.router.title', locale)"
    :subtitle="t('platform.products.router.description', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
  >
    <template #media>
      <CodeTabs
        :tabs="routerCodeTabs"
        :aria-label="t('platform.products.router.title', locale)"
      />
    </template>
  </HeroSplit01>
</template>
