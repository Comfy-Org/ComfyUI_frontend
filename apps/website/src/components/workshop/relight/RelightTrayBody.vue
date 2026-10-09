<script setup lang="ts">
import type { Relight, RelightTray } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import RelightSeed from './RelightSeed.vue'
import { RELIGHT_SECTIONS } from './sections'

const {
  tray,
  relight,
  locale = 'en'
} = defineProps<{
  tray: RelightTray
  relight: Relight
  locale?: Locale
}>()

const sections = RELIGHT_SECTIONS.filter((section) => section.tray === tray)
</script>

<template>
  <component
    :is="section.content"
    v-for="section in sections"
    :key="section.id"
    :relight
    :locale
  />
  <RelightSeed v-if="tray === 'generation'" :relight :locale />
</template>
