<script setup lang="ts">
import { EyeOff } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/site'
import { t } from '../../../i18n/site'
import { studioT as tc } from '../../../lib/workshop/cinematic-studio/copy'
const {
  current,
  height,
  pending = false,
  locale
} = defineProps<{
  current: Extract<Take, { status: 'done' }>
  height: string
  /** Hidden until it has loaded, so the frame keeps its size meanwhile. */
  pending?: boolean
  locale: Locale
}>()
const emit = defineEmits<{ loaded: [] }>()
const revealed = defineModel<boolean>('revealed', { required: true })
</script>

<template>
  <img
    v-if="current.output.kind === 'image'"
    :src="current.output.url"
    :alt="current.prompt"
    :class="
      cn(
        'block h-auto w-auto max-w-full transition-opacity duration-300',
        current.output.nsfw && !revealed && 'blur-2xl',
        pending && 'absolute opacity-0'
      )
    "
    :style="{ maxHeight: height }"
    @load="emit('loaded')"
    @error="emit('loaded')"
  />
  <video
    v-else-if="
      current.output.kind === 'video' && (!current.output.nsfw || revealed)
    "
    :key="current.id"
    :src="current.output.url"
    :aria-label="tc('cinematic.video.preview', {}, { locale: locale })"
    controls
    playsinline
    preload="metadata"
    :class="
      cn(
        'block h-auto w-auto max-w-full transition-opacity duration-300',
        pending && 'absolute opacity-0'
      )
    "
    :style="{ maxHeight: height }"
    @loadeddata="emit('loaded')"
    @error="emit('loaded')"
  />
  <div
    v-if="current.output.nsfw && !revealed"
    class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-primary-comfy-ink/40 text-center"
  >
    <EyeOff class="size-5 text-primary-warm-white" aria-hidden="true" />
    <span class="text-sm text-primary-warm-white">
      {{ t('workshop.output.nsfw', {}, { locale: locale }) }}
    </span>
    <button
      type="button"
      class="h-8 rounded-full px-4 text-xs font-bold tracking-wider text-primary-warm-white uppercase ring-1 ring-transparency-white-t20 ring-inset hover:bg-transparency-white-t8"
      @click="revealed = true"
    >
      {{ t('workshop.output.reveal', {}, { locale: locale }) }}
    </button>
  </div>
</template>
