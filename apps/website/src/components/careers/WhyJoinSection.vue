<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import WireNodeLayout from '../common/WireNodeLayout.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasons = [
  'careers.whyJoin.reason1',
  'careers.whyJoin.reason2',
  'careers.whyJoin.reason3',
  'careers.whyJoin.reason4',
  'careers.whyJoin.reason5'
] as const
</script>

<template>
  <section class="px-6 py-24 lg:px-20 lg:py-32">
    <WireNodeLayout :reasons right-card-padding="p-2" :locale>
      <template #right-card>
        <img
          src="https://media.comfy.org/website/about/team.webp"
          alt="Comfy team"
          class="mt-2 w-full rounded-2xl object-cover"
          loading="lazy"
          decoding="async"
        />
      </template>
      <template #right-card-mobile>
        <img
          src="https://media.comfy.org/website/about/team.webp"
          alt="Comfy team"
          class="mt-2 w-full rounded-2xl object-cover"
          loading="lazy"
          decoding="async"
        />
      </template>
    </WireNodeLayout>
  </section>
</template>
