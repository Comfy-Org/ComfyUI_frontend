<script setup lang="ts">
import type { ReshootCopyKey } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const FACTS: readonly ReshootCopyKey[] = [
  'reshoot.fact.input',
  'reshoot.fact.size',
  'reshoot.fact.time',
  'reshoot.fact.sound'
]
</script>

<template>
  <header class="flex flex-col gap-3" data-testid="reshoot-hero">
    <p class="text-sm text-primary-comfy-yellow">
      {{ rc('reshoot.eyebrow', locale) }}
    </p>
    <h1
      class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
    >
      {{ rc('reshoot.title', locale) }}
    </h1>
    <p class="max-w-3xl text-lg text-primary-warm-gray">
      {{ rc('reshoot.pick.lead', locale) }}
    </p>
    <div class="mt-1 flex flex-wrap gap-2 text-xs text-primary-warm-gray">
      <span
        v-for="fact in FACTS"
        :key="fact"
        class="rounded-full border border-transparency-white-t20 px-3 py-1.5"
      >
        {{ rc(fact, locale) }}
      </span>
      <span class="px-2 py-1.5">{{ rc('reshoot.credit', locale) }}</span>
    </div>
  </header>
</template>
