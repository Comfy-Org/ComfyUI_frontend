<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import CodeTabs from './CodeTabs.vue'
import { modelsApiCodeTabs } from './codeSamples'
import { platformCtas } from './ctas'
import PlatformHeroBadge from './PlatformHeroBadge.vue'

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
    title-class="sr-only"
    media-wrapper-class="hidden min-w-0 lg:block"
    :subtitle="t('platform.products.models.description', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="{
      label: ctas.docs.label,
      href: externalLinks.docsComfyRouter,
      target: '_blank'
    }"
  >
    <template #badge>
      <PlatformHeroBadge
        :locale="locale"
        :label="t('platform.products.models.title', locale)"
        :status-label="t('nav.badgeComingSoon', locale)"
      />
    </template>
    <template #aboveCtas>
      <div class="mt-8 lg:hidden">
        <CodeTabs
          :tabs="modelsApiCodeTabs"
          :label="t('platform.products.models.title', locale)"
          content-class="bg-[#2a2230]"
        />
      </div>
    </template>
    <template #media>
      <CodeTabs
        :tabs="modelsApiCodeTabs"
        :label="t('platform.products.models.title', locale)"
        content-class="bg-[#2a2230]"
      />
    </template>
  </HeroSplit01>
</template>
