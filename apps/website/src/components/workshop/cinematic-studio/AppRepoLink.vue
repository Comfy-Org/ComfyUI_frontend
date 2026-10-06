<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { cn } from '@comfyorg/tailwind-utils'

import { buttonVariants } from '@/components/ui/button'
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
  <component
    :is="repo ? 'a' : 'span'"
    :href="repo"
    :target="repo && '_blank'"
    :rel="repo && 'noopener noreferrer'"
    :class="
      cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        !repo && 'pointer-events-none opacity-50'
      )
    "
    @click="captureClick"
  >
    <span
      class="size-4 icon-mask mask-[url('/icons/social/github.svg')]"
      aria-hidden="true"
    />
    {{ t(repo ? 'cinematic.repo.view' : 'cinematic.repo.soon') }}
  </component>
</template>
