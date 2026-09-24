<script setup lang="ts">
import { EyeOff } from '@lucide/vue'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { framedStyle } from './aspect-style'
import CinematicTakeNotice from './CinematicTakeNotice.vue'
import CinematicTakeProgress from './CinematicTakeProgress.vue'

const {
  current,
  otherModel,
  height = '58svh',
  locale = 'en'
} = defineProps<{
  current: Take
  otherModel?: { slug: string; name: string }
  height?: string
  locale?: Locale
}>()

const emit = defineEmits<{
  again: []
  switchModel: [slug: string]
  editScene: []
}>()

const revealed = ref(false)

const TONE = {
  neutral:
    'bg-transparency-white-t4 ring-1 ring-transparency-white-t8 ring-inset',
  warning:
    'bg-primary-comfy-orange/5 ring-1 ring-primary-comfy-orange/25 ring-inset',
  error: 'bg-primary-comfy-red/5 ring-1 ring-primary-comfy-red/25 ring-inset'
} as const

function frameTone(take: Take): string | undefined {
  if (take.status === 'rendering') return 'bg-primary-comfy-ink-light'
  if (take.status === 'cancelled') return TONE.neutral
  if (take.status !== 'failed') return undefined
  if (take.reason === 'policy' || take.reason === 'validation')
    return TONE.warning
  return take.reason === 'noCredits' ? TONE.neutral : TONE.error
}
</script>

<template>
  <figure
    :class="
      cn(
        'group relative flex max-w-full items-center justify-center overflow-hidden rounded-md',
        frameTone(current)
      )
    "
    :style="
      current.status === 'done'
        ? undefined
        : framedStyle(current.aspect, height)
    "
  >
    <template v-if="current.status === 'done'">
      <img
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
    <CinematicTakeProgress
      v-else-if="current.status === 'rendering'"
      :take="current"
      :locale
    />
    <CinematicTakeNotice
      v-else
      :take="current"
      :other-model="otherModel"
      :locale
      @again="emit('again')"
      @switch-model="emit('switchModel', $event)"
      @edit-scene="emit('editScene')"
    />
    <slot />
  </figure>
</template>
