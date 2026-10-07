<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'

import ProductCard from '@/components/common/ProductCard.vue'
import Button from '@/components/ui/button/Button.vue'
import { apiKeysLink, externalLinks, getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { MODEL_TAB_PARAM } from '@/lib/workshop/explorer/model-tabs'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const openWeightsHref = `${getRoutes(locale).workshop}?${MODEL_TAB_PARAM}=open`
</script>

<template>
  <section
    aria-labelledby="model-access-heading"
    class="grid gap-5 md:grid-cols-2"
    data-testid="model-access"
  >
    <h2 id="model-access-heading" class="sr-only">
      {{ t('workshop.modelsHub.access.heading') }}
    </h2>
    <ProductCard
      :title="t('workshop.modelsHub.access.openTitle')"
      :description="t('workshop.modelsHub.access.openBody')"
      :cta="t('workshop.modelsHub.access.openCta')"
      :href="openWeightsHref"
      bg="bg-primary-comfy-plum"
      data-testid="model-access-open"
    />
    <div
      class="flex flex-col justify-between rounded-4.5xl bg-transparency-white-t8 p-8"
      data-testid="model-access-partner"
    >
      <h3 class="text-3xl font-light text-white lg:text-4xl">
        {{ t('workshop.modelsHub.access.partnerTitle') }}
      </h3>
      <div class="mt-auto pt-16">
        <p class="text-sm text-white/70">
          {{ t('workshop.modelsHub.access.partnerBody') }}
        </p>
        <div class="mt-4 flex flex-wrap gap-3">
          <Button :href="apiKeysLink({ onboarding: 'router' })" size="sm">
            {{ t('workshop.modelsHub.getApiKey') }}
          </Button>
          <Button
            :href="externalLinks.docsComfyRouter"
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            size="sm"
          >
            {{ t('workshop.modelsHub.access.apiDocs') }}
            <template #append>
              <ArrowUpRight aria-hidden="true" />
            </template>
          </Button>
        </div>
      </div>
    </div>
  </section>
</template>
