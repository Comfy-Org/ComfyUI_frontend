<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import type { ModelLaunchList } from './types'

import { translationsFor } from '@/i18n/translations'
import ModelLaunchListRow from './ModelLaunchListRow.vue'

const { locale = 'en', list } = defineProps<{
  list: ModelLaunchList
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-16 lg:px-20 lg:py-24">
    <div class="mx-auto flex max-w-3xl flex-col items-center text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t(list.headingKey) }}
      </h2>
    </div>

    <ul
      class="mx-auto mt-12 max-w-7xl divide-y divide-transparency-white-t8 border-y border-transparency-white-t8"
    >
      <ModelLaunchListRow
        v-for="item in list.items"
        :key="item.id"
        :item
        :locale
        :cta-label="list.ctaKey ? t(list.ctaKey) : undefined"
      />
    </ul>
  </section>
</template>
