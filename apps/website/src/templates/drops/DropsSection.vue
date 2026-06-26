<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import DropCard from './DropCard.vue'
import { drops } from '../../data/drops'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <h2
      class="text-primary-warm-white text-3xl font-light tracking-tight lg:text-5xl"
    >
      {{ t('launches.section.title', locale) }}
    </h2>

    <div class="mt-10 grid grid-cols-1 gap-6 md:grid-cols-6 lg:mt-12">
      <div
        v-for="(drop, index) in drops"
        :key="drop.id"
        :class="index < 4 ? 'md:col-span-3' : 'md:col-span-2'"
      >
        <DropCard :drop :locale />
      </div>
    </div>
  </section>
</template>
