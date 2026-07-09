<script setup lang="ts">
import HeroGraph from './HeroGraph.vue'
import type { Locale } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="relative overflow-hidden bg-primary-comfy-ink">
    <HeroGraph :locale />
  </section>
</template>
