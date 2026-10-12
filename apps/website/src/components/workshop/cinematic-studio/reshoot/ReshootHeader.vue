<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { workshopAppRepo } from '@/lib/workshop/apps'
import { RESHOOT_APP_SLUG } from '@/lib/workshop/cinematic-studio/analytics'
import type { Locale } from '@/i18n/translations'
import AppRepoLink from '@/components/workshop/cinematic-studio/AppRepoLink.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <header data-testid="reshoot-hero">
    <h1 class="mb-3 text-2xl font-semibold text-primary-warm-white lg:text-3xl">
      {{ t('reshoot.title') }}
    </h1>
    <div
      class="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex flex-col gap-1">
        <p class="text-lg text-primary-warm-gray">
          {{ t('reshoot.pick.lead') }}
        </p>
        <p class="text-xs text-primary-warm-gray/80">
          {{ t('reshoot.credit') }}
        </p>
      </div>
      <AppRepoLink
        :repo="workshopAppRepo('reshoot')"
        :app-slug="RESHOOT_APP_SLUG"
        :locale
        class="shrink-0"
      />
    </div>
  </header>
</template>
