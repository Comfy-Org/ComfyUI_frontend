<script setup lang="ts">
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <header class="flex flex-col gap-3" data-testid="reshoot-hero">
    <h1
      class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
    >
      {{ rc('reshoot.title', locale) }}
    </h1>
    <p class="text-lg text-primary-warm-gray">
      {{ rc('reshoot.pick.lead', locale) }}
    </p>
    <p class="flex flex-col gap-1 text-xs text-primary-warm-gray/80">
      <span>{{ rc('reshoot.credit', locale) }}</span>
      <span>{{ rc('reshoot.demoNote', locale) }}</span>
    </p>
  </header>
</template>
