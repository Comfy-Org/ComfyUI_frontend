<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import { externalLinks } from '../../config/routes'
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
    beta
    :badge-text="t('platform.hero.badge', locale)"
    :title="t('platform.products.models.title', locale)"
    :subtitle="t('platform.products.models.description', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="{
      label: ctas.docs.label,
      href: externalLinks.docsComfyRouter,
      target: '_blank'
    }"
  >
    <template #media>
      <CodeTabs
        :tabs="modelsApiCodeTabs"
        :label="t('platform.products.models.title', locale)"
      />
    </template>
  </HeroSplit01>
</template>
