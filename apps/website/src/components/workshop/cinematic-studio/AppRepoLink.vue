<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { captureWorkshopEvent } from '../../../scripts/posthog'

const {
  repo,
  locale = 'en',
  appSlug
} = defineProps<{
  repo?: string
  locale?: Locale
  /** The app this link belongs to, for the click's analytics. */
  appSlug?: string
}>()

function captureClick() {
  if (!repo || !appSlug) return
  captureWorkshopEvent({
    name: 'github_clicked',
    properties: { app_slug: appSlug, page_type: 'app' }
  })
}
</script>

<template>
  <component
    :is="repo ? 'a' : 'span'"
    :href="repo"
    :target="repo && '_blank'"
    :rel="repo && 'noopener noreferrer'"
    :class="
      cn(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium',
        repo
          ? 'border-transparency-white-t20 bg-transparency-white-t4 text-primary-warm-white transition hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none'
          : 'border-transparency-white-t8 text-primary-warm-gray'
      )
    "
    @click="captureClick"
  >
    <span
      class="size-4 icon-mask mask-[url('/icons/social/github.svg')]"
      aria-hidden="true"
    />
    {{ tc(repo ? 'cinematic.repo.view' : 'cinematic.repo.soon', locale) }}
    <ArrowUpRight v-if="repo" class="size-3.5" aria-hidden="true" />
  </component>
</template>
