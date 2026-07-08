<script setup lang="ts">
import HeroWorkflow from './HeroWorkflow.vue'
import type { Locale } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="hero-dot-grid relative overflow-hidden bg-primary-comfy-ink">
    <HeroWorkflow :locale />
  </section>
</template>
