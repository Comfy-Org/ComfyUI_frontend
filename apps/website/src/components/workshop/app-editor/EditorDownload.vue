<script setup lang="ts">
import { Download } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicTooltip from '../cinematic-studio/CinematicTooltip.vue'

const { file, locale = 'en' } = defineProps<{
  /** The finished result; until there is one the button stays disabled. */
  file?: { href: string; name: string }
  locale?: Locale
}>()

const shape =
  'inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-primary-comfy-yellow px-3 text-sm font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none sm:px-3.5'
</script>

<template>
  <a v-if="file" :href="file.href" :download="file.name" :class="shape">
    <Download class="size-4" aria-hidden="true" />
    <span class="max-sm:sr-only">{{ tc('cinematic.download', locale) }}</span>
  </a>
  <CinematicTooltip
    v-else
    :text="tc('cinematic.download.locked', locale)"
    side="bottom"
  >
    <button
      type="button"
      aria-disabled="true"
      :class="cn(shape, 'cursor-not-allowed opacity-40')"
    >
      <Download class="size-4" aria-hidden="true" />
      <span class="max-sm:sr-only">{{ tc('cinematic.download', locale) }}</span>
    </button>
  </CinematicTooltip>
</template>
