<script setup lang="ts">
import { translationsFor } from '../../../../i18n/translations'
import { workshopAppRepo } from '../../../../lib/workshop/apps'
import type { Locale } from '../../../../i18n/translations'
import AppRepoLink from '../AppRepoLink.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <header class="flex flex-col gap-3" data-testid="reshoot-hero">
    <div class="flex flex-wrap items-center gap-3">
      <h1
        class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ t('reshoot.title') }}
      </h1>
      <AppRepoLink
        :repo="workshopAppRepo('reshoot')"
        :locale
        class="sm:ml-auto"
      />
    </div>
    <p class="text-lg text-primary-warm-gray">
      {{ t('reshoot.pick.lead') }}
    </p>
    <p class="text-xs text-primary-warm-gray/80">
      {{ t('reshoot.credit') }}
    </p>
  </header>
</template>
