<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { RunOutput } from '@/config/workshop-run'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  urls,
  kind,
  locale = 'en'
} = defineProps<{
  urls: readonly string[]
  kind: RunOutput['kind']
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const selected = defineModel<number>({ required: true })
</script>

<template>
  <div
    class="grid grid-cols-4 gap-2 border-t border-transparency-white-t8 p-4 sm:grid-cols-6 lg:grid-cols-9"
    data-testid="output-thumbnails"
  >
    <button
      v-for="(url, index) in urls"
      :key="index"
      type="button"
      :aria-label="t('workshop.output.select', { n: index + 1 })"
      :aria-pressed="index === selected"
      :data-testid="`output-thumb-${index}`"
      :class="
        cn(
          'aspect-square cursor-pointer overflow-hidden rounded-xl border-2 transition-opacity',
          index === selected
            ? 'border-primary-comfy-yellow'
            : 'border-transparent opacity-60 hover:opacity-100'
        )
      "
      @click="selected = index"
    >
      <video
        v-if="kind === 'video'"
        :src="url"
        class="size-full object-cover"
        muted
        playsinline
        preload="metadata"
      />
      <img
        v-else-if="kind === 'image'"
        :src="url"
        alt=""
        class="size-full object-cover"
      />
      <span v-else>{{ index + 1 }}</span>
    </button>
  </div>
</template>
