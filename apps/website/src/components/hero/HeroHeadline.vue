<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import NodeBadge from '../common/NodeBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const title = t('hero.title', locale)
const lines = title.split('\n').map((line) =>
  line
    .split(' ')
    .filter(Boolean)
    .map((word) => ({ text: word.toUpperCase() }))
)
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <h1 class="sr-only">{{ title.split('\n').join(' ') }}</h1>
    <NodeBadge
      v-for="(segments, i) in lines"
      :key="i"
      aria-hidden="true"
      :segments="segments"
      segment-class=""
      text-class="text-2xl sm:text-4xl lg:text-6xl"
    />
  </div>
</template>
