<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import WireNodeLayout from '../common/WireNodeLayout.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasons = [
  'about.careers.reason1',
  'about.careers.reason2',
  'about.careers.reason3',
  'about.careers.reason4'
] as const
</script>

<template>
  <section class="px-6 py-24 lg:px-20 lg:py-32">
    <WireNodeLayout :reasons right-card-padding="p-6" :locale>
      <template #right-card>
        <img
          src="https://media.comfy.org/website/about/c-logo.webp"
          alt="Comfy logo"
          class="mt-6 w-full"
        />
      </template>
      <template #right-card-mobile>
        <img
          src="https://media.comfy.org/website/about/c-logo.webp"
          alt="Comfy logo"
          class="mt-6 w-full max-w-xs"
        />
      </template>
    </WireNodeLayout>
  </section>
</template>
