<script setup lang="ts">
import { workshopAppRepo } from '../../../../lib/workshop/apps'
import { studioT as rc } from '../../../../lib/workshop/cinematic-studio/copy'
import type { Locale } from '../../../../i18n/site'
import AppRepoLink from '../AppRepoLink.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <header class="flex flex-col gap-3" data-testid="reshoot-hero">
    <div class="flex flex-wrap items-center gap-3">
      <h1
        class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ rc('reshoot.title', {}, { locale: locale }) }}
      </h1>
      <AppRepoLink
        :repo="workshopAppRepo('reshoot')"
        :locale
        class="sm:ml-auto"
      />
    </div>
    <p class="text-lg text-primary-warm-gray">
      {{ rc('reshoot.pick.lead', {}, { locale: locale }) }}
    </p>
    <p class="text-xs text-primary-warm-gray/80">
      {{ rc('reshoot.credit', {}, { locale: locale }) }}
    </p>
  </header>
</template>
