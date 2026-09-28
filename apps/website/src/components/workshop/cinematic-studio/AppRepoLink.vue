<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { repo, locale = 'en' } = defineProps<{
  repo?: string
  locale?: Locale
}>()

const shape =
  'inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium'
</script>

<template>
  <a
    v-if="repo"
    :href="repo"
    target="_blank"
    rel="noopener noreferrer"
    :class="
      cn(
        shape,
        'border-transparency-white-t20 bg-transparency-white-t4 text-primary-warm-white transition hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none'
      )
    "
  >
    <span
      class="size-4 icon-mask mask-[url('/icons/social/github.svg')]"
      aria-hidden="true"
    />
    {{ tc('cinematic.repo.view', locale) }}
    <ArrowUpRight class="size-3.5" aria-hidden="true" />
  </a>
  <span
    v-else
    :class="cn(shape, 'border-transparency-white-t8 text-primary-warm-gray')"
  >
    <span
      class="size-4 icon-mask mask-[url('/icons/social/github.svg')]"
      aria-hidden="true"
    />
    {{ tc('cinematic.repo.soon', locale) }}
  </span>
</template>
