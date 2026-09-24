<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import { failureLabelKey } from '../../../lib/workshop/failure-label'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { framedStyle } from './aspect-style'

const {
  current,
  height = '58svh',
  locale = 'en'
} = defineProps<{
  current: Take
  height?: string
  locale?: Locale
}>()

function statusText(take: Take) {
  if (take.status === 'rendering')
    return tc('cinematic.stage.rendering', locale)
  if (take.status === 'failed') return t(failureLabelKey[take.reason], locale)
  if (take.status === 'cancelled') return t('workshop.output.cancelled', locale)
  return ''
}
</script>

<template>
  <figure
    :class="
      cn(
        'group relative flex max-w-full items-center justify-center overflow-hidden rounded-md',
        current.status !== 'done' && 'bg-transparency-white-t4'
      )
    "
    :style="
      current.status === 'done'
        ? undefined
        : framedStyle(current.aspect, height)
    "
  >
    <img
      v-if="current.status === 'done'"
      :src="current.output.url"
      :alt="current.prompt"
      class="block h-auto w-auto max-w-full"
      :style="{ maxHeight: height }"
    />
    <figcaption
      v-else
      role="status"
      class="flex flex-col items-center gap-3 text-sm text-primary-comfy-canvas"
    >
      {{ statusText(current) }}
      <span
        v-if="current.status === 'rendering'"
        class="h-0.5 w-48 overflow-hidden rounded-full bg-transparency-white-t8"
        aria-hidden="true"
      >
        <span
          class="block h-full w-1/3 animate-pulse rounded-full bg-primary-warm-white"
        />
      </span>
    </figcaption>
    <slot />
  </figure>
</template>
