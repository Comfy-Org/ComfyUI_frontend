<script setup lang="ts">
import { workshopAppRepo } from '../../../../lib/workshop/apps'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import AppRepoLink from '../AppRepoLink.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <header class="flex flex-col gap-3" data-testid="reshoot-hero">
    <h1
      class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
    >
      {{ rc('reshoot.title', locale) }}
    </h1>
    <div
      class="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex flex-col gap-3">
        <p class="text-lg text-primary-warm-gray">
          {{ rc('reshoot.pick.lead', locale) }}
        </p>
        <p class="text-xs text-primary-warm-gray/80">
          {{ rc('reshoot.credit', locale) }}
        </p>
      </div>
      <AppRepoLink
        :repo="workshopAppRepo('reshoot')"
        :locale
        class="shrink-0"
      />
    </div>
  </header>
</template>
