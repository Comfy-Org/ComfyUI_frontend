<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { ArrowUpRight } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import type { Locale } from '@/i18n/translations'
import { captureWorkshopEvent } from '@/scripts/posthog'

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
const { t } = translationsFor(locale)

function captureClick() {
  if (!repo || !appSlug) return
  captureWorkshopEvent({
    name: 'github_clicked',
    properties: { app_slug: appSlug, page_type: 'app' }
  })
}
</script>

<template>
  <Button
    v-if="repo"
    variant="secondaryOutline"
    size="sm"
    :href="repo"
    target="_blank"
    rel="noopener noreferrer"
    class="shrink-0"
    @click="captureClick"
  >
    <template #prepend>
      <span
        class="size-4 icon-mask mask-[url('/icons/social/github.svg')]"
        aria-hidden="true"
      />
    </template>
    {{ t('cinematic.repo.view') }}
    <template #append>
      <ArrowUpRight class="size-3.5" aria-hidden="true" />
    </template>
  </Button>
  <span
    v-else
    class="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-transparency-white-t8 px-3.5 text-sm font-medium text-primary-warm-gray"
  >
    <span
      class="size-4 icon-mask mask-[url('/icons/social/github.svg')]"
      aria-hidden="true"
    />
    {{ t('cinematic.repo.soon') }}
  </span>
</template>
