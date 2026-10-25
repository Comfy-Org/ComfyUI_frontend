<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'

import Button from '@/components/ui/button/Button.vue'
import { externalLinks } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { captureWorkshopEvent } from '@/scripts/posthog'

const {
  repo,
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
  <Button
    as="a"
    :href="repo ?? externalLinks.githubOrg"
    target="_blank"
    rel="noopener noreferrer"
    variant="outline"
    size="sm"
    @click="captureClick"
  >
    <template #prepend>
      <span
        class="size-4 icon-mask mask-[url('/icons/social/github.svg')]"
        aria-hidden="true"
      />
    </template>
    {{ repo ? t('cinematic.repo.view') : t('cinematic.repo.org') }}
  </Button>
</template>
