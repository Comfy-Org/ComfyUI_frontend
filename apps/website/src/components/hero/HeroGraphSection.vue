<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { externalLinks } from '../../config/routes'
import BrandButton from '../common/BrandButton.vue'
import HeroHeadline from './HeroHeadline.vue'
import HeroGraph from './HeroGraph.vue'
import HeroMobileFlow from './HeroMobileFlow.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col items-center px-6 pt-6 pb-16 lg:px-10"
  >
    <div class="hidden w-full md:block">
      <HeroGraph :locale />
    </div>

    <div class="flex w-full flex-col items-center gap-8 md:hidden">
      <div class="flex flex-col items-center gap-6">
        <HeroHeadline :locale class="text-3xl" />
        <BrandButton
          :href="externalLinks.cloudCta('hero_get_started_free')"
          variant="outline"
          class="uppercase"
        >
          {{ t('hero.getStartedFree', locale) }}
        </BrandButton>
      </div>
      <HeroMobileFlow />
    </div>
  </section>
</template>
