<script setup lang="ts">
import HeroGraph from './HeroGraph.vue'
import type { Locale } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="relative overflow-hidden bg-primary-comfy-ink">
    <!-- Gooey filter that merges the headline's two highlighter blocks into a
         single liquid shape. Referenced by HeroHeadline via filter: url(#…). -->
    <svg class="absolute size-0" aria-hidden="true">
      <defs>
        <filter id="hero-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b" />
          <feColorMatrix
            in="b"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
          />
        </filter>
      </defs>
    </svg>

    <HeroGraph :locale />
  </section>
</template>
