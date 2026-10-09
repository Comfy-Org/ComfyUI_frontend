<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { ArrowUpRight } from '@lucide/vue'

import { externalLinks } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { captureWorkshopEvent } from '@/scripts/posthog'

const {
  repo = externalLinks.githubOrg,
  locale = 'en',
  appSlug
} = defineProps<{
  /** The app's own repository; until it exists the link opens Comfy's GitHub. */
  repo?: string
  locale?: Locale
  /** The app this link belongs to, for the click's analytics. */
  appSlug?: string
}>()
const { t } = translationsFor(locale)

function captureClick() {
  if (!appSlug) return
  captureWorkshopEvent({
    name: 'github_clicked',
    properties: { app_slug: appSlug, page_type: 'app' }
  })
}
</script>

<template>
  <a
    :href="repo"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-transparency-white-t20 bg-transparency-white-t4 px-3.5 text-sm font-medium text-primary-warm-white transition hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
    @click="captureClick"
  >
    <span
      class="size-4 icon-mask mask-[url('/icons/social/github.svg')]"
      aria-hidden="true"
    />
    {{ t('cinematic.repo.view') }}
    <ArrowUpRight class="size-3.5" aria-hidden="true" />
  </a>
</template>
