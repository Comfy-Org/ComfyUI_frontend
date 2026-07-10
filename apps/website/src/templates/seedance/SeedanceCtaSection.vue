<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import BrandButton from '../../components/common/BrandButton.vue'
import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <section>
    <CtaCenter01
      :heading="t('seedance.cta.heading', locale)"
      :subtitle="t('seedance.cta.subtitle', locale)"
      :primary-cta="{
        label: t('seedance.cta.primaryCta', locale),
        href: externalLinks.workflows,
        target: '_blank'
      }"
      :secondary-cta="{
        label: t('seedance.cta.secondaryCta', locale),
        href: externalLinks.workflows,
        target: '_blank'
      }"
    />

    <div class="max-w-9xl mx-auto px-6 pb-16 lg:pb-24">
      <div
        class="rounded-5xl bg-primary-comfy-yellow flex flex-wrap items-end justify-between gap-8 p-8"
      >
        <div class="min-w-0 flex-1">
          <h3
            class="text-2xl font-medium text-primary-comfy-ink lg:text-3xl/tight"
          >
            {{ t('seedance.cta.highlightTitle', locale) }}
          </h3>
          <p class="mt-4 text-base/relaxed font-light text-primary-comfy-ink">
            {{ t('seedance.cta.highlightDescription', locale) }}
          </p>
        </div>

        <BrandButton
          :href="routes.mcp"
          variant="inverse"
          size="sm"
          class="h-12 shrink-0 px-5 uppercase"
        >
          {{ t('seedance.cta.highlightCta', locale) }}
        </BrandButton>
      </div>
    </div>
  </section>
</template>
