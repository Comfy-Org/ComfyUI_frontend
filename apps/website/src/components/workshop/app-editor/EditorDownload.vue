<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { Download } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import CinematicTooltip from '@/components/workshop/cinematic-studio/CinematicTooltip.vue'

const { file, locale = 'en' } = defineProps<{
  /** The finished result; until there is one the button stays disabled. */
  file?: { href: string; name: string }
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const shape =
  'inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-primary-comfy-yellow px-3 text-sm font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none sm:px-3.5'
</script>

<template>
  <a v-if="file" :href="file.href" :download="file.name" :class="shape">
    <Download class="size-4" aria-hidden="true" />
    <span class="max-sm:sr-only">{{ t('cinematic.download.label') }}</span>
  </a>
  <CinematicTooltip v-else :text="t('cinematic.download.locked')" side="bottom">
    <button
      type="button"
      aria-disabled="true"
      :class="cn(shape, 'cursor-not-allowed opacity-40')"
    >
      <Download class="size-4" aria-hidden="true" />
      <span class="max-sm:sr-only">{{ t('cinematic.download.label') }}</span>
    </button>
  </CinematicTooltip>
</template>
