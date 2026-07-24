<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
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
      <HeroHeadline :locale class="text-3xl" />
      <HeroMobileFlow />
    </div>
  </section>
</template>
