<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'

import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import AppRepoLink from './AppRepoLink.vue'

const {
  name,
  repo,
  appSlug,
  locale = 'en'
} = defineProps<{
  name: string
  repo?: string
  /** The app the GitHub link belongs to, for the click's analytics. */
  appSlug?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const routes = getRoutes(locale)
</script>

<template>
  <div
    class="pointer-events-none sticky top-0 z-40 flex items-center justify-between gap-3 p-3 sm:p-4"
    data-testid="app-shell-bar"
  >
    <div
      class="pointer-events-auto flex min-w-0 items-center gap-1 rounded-2xl bg-primary-comfy-ink/80 p-1 pr-3 ring-1 ring-transparency-white-t8 backdrop-blur-sm"
    >
      <a
        :href="routes.home"
        class="flex h-9 shrink-0 items-center rounded-xl px-2 outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        :aria-label="t('hubPages.appShell.home')"
      >
        <img src="/icons/logo.svg" alt="" class="h-5 w-auto max-sm:hidden" />
        <img src="/icons/logomark.svg" alt="" class="h-5 w-auto sm:hidden" />
      </a>
      <a
        :href="routes.hubApps"
        class="grid size-9 shrink-0 place-items-center rounded-xl text-content-secondary outline-none hover:bg-transparency-white-t8 hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        :aria-label="t('cinematic.backToApps')"
        data-testid="apps-back"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
      </a>
      <h1 class="truncate text-sm font-semibold text-primary-warm-white">
        {{ name }}
      </h1>
      <span
        class="ml-2 shrink-0 rounded-full bg-primary-comfy-yellow/15 px-2 py-0.5 text-2xs font-semibold tracking-wider text-primary-comfy-yellow uppercase"
      >
        {{ t('cinematic.beta') }}
      </span>
    </div>
    <div v-if="repo" class="pointer-events-auto flex items-center gap-2">
      <AppRepoLink :repo :app-slug="appSlug" :locale class="backdrop-blur-sm" />
    </div>
  </div>
</template>
