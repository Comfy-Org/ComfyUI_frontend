<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import type { ModelLaunchHighlight } from './types'

import ModelLaunchHighlightCard from './ModelLaunchHighlightCard.vue'

const { locale = 'en', highlight } = defineProps<{
  highlight: ModelLaunchHighlight
  locale?: Locale
}>()
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-8 lg:px-16 lg:py-12">
    <ModelLaunchHighlightCard :highlight :locale />
  </section>
</template>
