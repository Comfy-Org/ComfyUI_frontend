<script setup lang="ts">
import HeroCentered01 from '../../components/blocks/HeroCentered01.vue'
import BrandButton from '../../components/common/BrandButton.vue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <section class="max-w-9xl mx-auto pt-24 pb-8 lg:pt-30 lg:pb-12">
    <HeroCentered01
      :eyebrow="t('platform.router.hero.eyebrow', locale)"
      :title="t('platform.modelsHero.heading', locale)"
      :subtitle="t('platform.modelsHero.subtitle', locale)"
    >
      <div class="mt-10 flex flex-col gap-4 sm:flex-row">
        <BrandButton
          :href="routes.contact"
          size="lg"
          class="px-8 py-4 text-base uppercase"
        >
          {{ t('platform.router.hero.primaryCta', locale) }}
        </BrandButton>
        <BrandButton
          :href="routes.models"
          variant="outline"
          size="lg"
          class="px-8 py-4 text-base uppercase"
        >
          {{ t('platform.router.hero.secondaryCta', locale) }}
        </BrandButton>
      </div>
    </HeroCentered01>
  </section>
</template>
