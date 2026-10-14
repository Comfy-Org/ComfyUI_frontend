<script setup lang="ts">
import SectionHeader from '@/components/common/SectionHeader.vue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogueFeature } from '@/lib/workshop/catalogue-features'
import FeaturedCarousel from './FeaturedCarousel.vue'
import HubBreadcrumb from './HubBreadcrumb.vue'

const {
  title,
  subtitle,
  features,
  featuresLabel,
  locale = 'en'
} = defineProps<{
  title: string
  subtitle: string
  features: readonly CatalogueFeature[]
  featuresLabel: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const routes = getRoutes(locale)
</script>

<template>
  <section
    class="mb-12 grid items-center gap-10 pt-8 max-sm:mb-8 max-sm:pt-5 lg:pt-12 xl:grid-cols-[minmax(0,1.025fr)_minmax(0,1fr)] xl:gap-16"
  >
    <div class="flex min-w-0 flex-col items-start gap-6">
      <HubBreadcrumb
        :crumbs="[
          {
            label: t('workshop.catalogue.eyebrow'),
            href: routes.hubExplore,
            testId: 'hub-back'
          },
          { label: title }
        ]"
        :locale
      />
      <SectionHeader heading-tag="h1" heading-size="hero" align="start">
        {{ title }}
      </SectionHeader>
      <p
        class="max-w-xl text-base/relaxed font-light text-primary-comfy-canvas lg:text-lg"
      >
        {{ subtitle }}
      </p>
    </div>

    <FeaturedCarousel
      v-if="features.length"
      :features
      :label="featuresLabel"
      :locale
      class="min-w-0"
    />
  </section>
</template>
