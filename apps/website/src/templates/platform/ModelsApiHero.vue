<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import { apiKeysLink, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { routerT } from './routerCopy'
import CodeTabs from './CodeTabs.vue'
import { routerCodeTabs } from './codeSamples'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <HeroSplit01
    :locale="locale"
    compact
    beta
    :badge-text="routerT('platform.router.badge.label', locale)"
    :title="t('platform.modelsHero.heading', locale)"
    title-class="text-primary-comfy-yellow text-3xl/tight font-light tracking-[-1.44px] md:text-4xl/tight lg:text-5xl/tight"
    class="lg:items-stretch"
    media-wrapper-class="hidden min-w-0 lg:flex lg:flex-col"
    :subtitle="t('platform.modelsHero.subtitle', locale)"
    :primary-cta="{
      label: routerT('platform.router.cta.getApiKey', locale),
      href: apiKeysLink({ onboarding: 'router' }),
      target: '_blank'
    }"
    :secondary-cta="{
      label: routerT('platform.router.cta.browseModels', locale),
      href: routes.modelsShowcase
    }"
  >
    <template #aboveCtas>
      <div class="mt-8 lg:hidden">
        <CodeTabs
          :tabs="routerCodeTabs"
          :label="t('platform.products.models.title', locale)"
          content-class="bg-[#2a2230]"
          :copy-label="t('ui.copy', locale)"
          :copied-label="t('ui.copied', locale)"
        />
      </div>
    </template>
    <template #media>
      <CodeTabs
        :tabs="routerCodeTabs"
        :label="t('platform.products.models.title', locale)"
        content-class="bg-[#2a2230]"
        :copy-label="t('ui.copy', locale)"
        :copied-label="t('ui.copied', locale)"
        fill
      />
    </template>
  </HeroSplit01>
</template>
