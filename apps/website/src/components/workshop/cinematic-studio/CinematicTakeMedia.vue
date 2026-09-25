<script setup lang="ts">
import { EyeOff } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
const { current, height, locale } = defineProps<{
  current: Extract<Take, { status: 'done' }>
  height: string
  locale: Locale
}>()
const revealed = defineModel<boolean>('revealed', { required: true })
</script>

<template>
  <img
    v-if="current.output.kind === 'image'"
    :src="current.output.url"
    :alt="current.prompt"
    :class="
      cn(
        'block h-auto w-auto max-w-full',
        current.output.nsfw && !revealed && 'blur-2xl'
      )
    "
    :style="{ maxHeight: height }"
  />
  <video
    v-else-if="
      current.output.kind === 'video' && (!current.output.nsfw || revealed)
    "
    :key="current.id"
    :src="current.output.url"
    :aria-label="tc('cinematic.video.preview', locale)"
    controls
    playsinline
    preload="metadata"
    class="block h-auto w-auto max-w-full"
    :style="{ maxHeight: height }"
  />
  <div
    v-if="current.output.nsfw && !revealed"
    class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-primary-comfy-ink/40 text-center"
  >
    <EyeOff class="size-5 text-primary-warm-white" aria-hidden="true" />
    <span class="text-sm text-primary-warm-white">
      {{ t('workshop.output.nsfw', locale) }}
    </span>
    <button
      type="button"
      class="h-8 rounded-full px-4 text-xs font-bold tracking-wider text-primary-warm-white uppercase ring-1 ring-transparency-white-t20 ring-inset hover:bg-transparency-white-t8"
      @click="revealed = true"
    >
      {{ t('workshop.output.reveal', locale) }}
    </button>
  </div>
</template>
