<script setup lang="ts">
import { workshopAppRepo } from '../../../../lib/workshop/apps'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import AppRepoLink from '../AppRepoLink.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <header class="flex flex-col gap-3" data-testid="reshoot-hero">
    <div class="flex flex-wrap items-center gap-3">
      <h1
        class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ rc('reshoot.title', locale) }}
      </h1>
      <AppRepoLink
        :repo="workshopAppRepo('reshoot')"
        :locale
        class="sm:ml-auto"
      />
    </div>
    <p class="text-lg text-primary-warm-gray">
      {{ rc('reshoot.pick.lead', locale) }}
    </p>
    <p class="text-xs text-primary-warm-gray/80">
      {{ rc('reshoot.credit', locale) }} ·
      {{ rc('reshoot.demoNote', locale) }}
    </p>
  </header>
</template>
