<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'
import Button from '../ui/button/Button.vue'
import PricingSection from './PricingSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <PricingSection :locale>
    <template #banner>
      <div
        class="rounded-5xl bg-transparency-white-t4 mb-2 flex flex-col gap-6 px-8 py-6 max-lg:mx-auto max-lg:max-w-lg lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <p class="text-primary-warm-white text-lg font-medium">
            {{ t('pricing.freeTrial.title', locale) }}
          </p>
          <p class="mt-1 text-sm text-primary-comfy-canvas">
            {{ t('pricing.freeTrial.description', locale) }}
          </p>
        </div>

        <Button
          :href="externalLinks.cloud"
          variant="outline"
          class="shrink-0 max-lg:w-full"
        >
          {{ t('pricing.freeTrial.cta', locale) }}
        </Button>
      </div>
    </template>
  </PricingSection>
</template>
