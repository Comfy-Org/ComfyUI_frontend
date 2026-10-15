<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'

import Badge from '@/components/ui/badge/Badge.vue'
import IconButton from '@/components/ui/icon-button/IconButton.vue'
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
      <IconButton
        as="a"
        :href="routes.hubApps"
        size="sm"
        :aria-label="t('cinematic.backToApps')"
        data-testid="apps-back"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
      </IconButton>
      <h1 class="truncate text-sm font-semibold text-primary-warm-white">
        {{ name }}
      </h1>
      <Badge variant="category" size="xs" class="ml-2">
        {{ t('cinematic.beta') }}
      </Badge>
    </div>
    <div v-if="repo" class="pointer-events-auto flex items-center gap-2">
      <AppRepoLink :repo :app-slug="appSlug" :locale class="backdrop-blur-sm" />
    </div>
  </div>
</template>
