<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'

const {
  cloudUrl,
  downloadUrl,
  runsHere,
  tutorialUrl,
  locale = 'en'
} = defineProps<{
  /** Comfy Cloud, opened on this template. */
  cloudUrl: string
  downloadUrl: string
  /** Whether the model above already runs on the page, which then owns the
    page's one filled action. */
  runsHere: boolean
  tutorialUrl: string | undefined
  locale?: Locale
}>()

const action =
  'inline-flex h-11 w-full items-center justify-center rounded-2xl px-5 text-sm font-bold tracking-wider uppercase transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 sm:w-auto'
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="workflow-actions">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <a
        :href="cloudUrl"
        target="_blank"
        rel="noopener"
        :class="
          cn(
            action,
            runsHere
              ? 'border border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink'
              : 'bg-primary-comfy-yellow text-primary-comfy-ink hover:opacity-90'
          )
        "
        data-testid="workflow-open-cloud"
      >
        {{ t('workshop.v2.workflow.openCloud', locale) }}
      </a>
      <a
        :href="downloadUrl"
        download
        :class="
          cn(
            action,
            'border border-transparency-white-t20 text-primary-warm-white hover:bg-transparency-white-t8'
          )
        "
        data-testid="workflow-download"
      >
        {{ t('workshop.v2.workflow.download', locale) }}
      </a>
      <a
        v-if="tutorialUrl"
        :href="tutorialUrl"
        target="_blank"
        rel="noopener"
        class="inline-flex h-11 items-center rounded-lg px-2 text-sm text-primary-warm-gray transition-colors outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      >
        {{ t('workshop.v2.workflow.tutorial', locale) }}
      </a>
    </div>

    <!-- The PRD's confirmed path for a 1P workflow: the user's own Cloud
      account runs it, and Desktop is not the first stop. -->
    <p class="text-xs text-content-muted" data-testid="workflow-save-note">
      {{ t('workshop.v2.workflow.openCloudNote', locale) }}
    </p>
  </div>
</template>
