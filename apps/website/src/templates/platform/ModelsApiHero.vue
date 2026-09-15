<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
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
    :badge-text="t('platform.router.badge.label', locale)"
    :title="t('platform.modelsHero.heading', locale)"
    title-class="text-primary-comfy-yellow text-3xl/tight font-bold tracking-[-1.44px] md:text-4xl/tight lg:text-5xl/tight"
    media-wrapper-class="hidden min-w-0 lg:block"
    :subtitle="t('platform.modelsHero.subtitle', locale)"
    :primary-cta="{
      label: t('platform.router.cta.getApiKey', locale),
      href: externalLinks.apiKeys,
      target: '_blank'
    }"
    :secondary-cta="{
      label: t('platform.router.cta.browseModels', locale),
      href: routes.models
    }"
  >
    <template #aboveCtas>
      <div class="mt-8 lg:hidden">
        <CodeTabs
          :tabs="routerCodeTabs"
          :label="t('platform.products.models.title', locale)"
          content-class="bg-[#2a2230]"
        />
      </div>
    </template>
    <template #media>
      <CodeTabs
        :tabs="routerCodeTabs"
        :label="t('platform.products.models.title', locale)"
        content-class="bg-[#2a2230]"
      />
    </template>
  </HeroSplit01>
</template>
