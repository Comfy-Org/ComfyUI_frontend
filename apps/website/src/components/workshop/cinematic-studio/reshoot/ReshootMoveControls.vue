<script setup lang="ts">
import { translationsFor } from '../../../../i18n/translations'
import { X } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { CameraKey } from '../../../../lib/workshop/cinematic-studio/reshoot'
import { frameTime } from '../../../../lib/workshop/cinematic-studio/reshoot'
import type { Locale } from '../../../../i18n/translations'

// The move's keys. Scrubbing, keying and the motion curve are on the
// timeline under the preview; a key here jumps to it.
const {
  keys,
  disabled = false,
  locale = 'en'
} = defineProps<{
  keys: readonly CameraKey[]
  disabled?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ remove: [frame: number] }>()
const frame = defineModel<number>('frame', { required: true })
</script>

<template>
  <div class="flex flex-col gap-3">
    <p
      v-if="disabled"
      class="rounded-xl bg-transparency-white-t8 px-3 py-2 text-xs text-primary-warm-white"
    >
      {{ t('reshoot.needsDepth') }}
    </p>
    <p class="text-xs/relaxed text-primary-warm-gray">
      {{ t('reshoot.move.help') }}
    </p>
    <ul v-if="keys.length" class="flex flex-wrap gap-1.5">
      <li
        v-for="key in keys"
        :key="key.frame"
        :class="
          cn(
            'flex h-7 items-center gap-1 rounded-lg pr-1 font-mono text-[11px] text-primary-warm-white tabular-nums',
            key.frame === frame
              ? 'bg-primary-comfy-yellow/20 ring-1 ring-primary-comfy-yellow/60 ring-inset'
              : 'bg-transparency-white-t8'
          )
        "
      >
        <button
          type="button"
          :disabled
          class="flex h-full items-center gap-1 pl-2.5"
          :aria-label="t('reshoot.move.goTo', { time: frameTime(key.frame) })"
          @click="frame = key.frame"
        >
          {{ frameTime(key.frame) }}
          <span class="text-primary-warm-gray">
            {{ key.camera.azimuth }}° / {{ key.camera.elevation }}°
          </span>
        </button>
        <button
          type="button"
          :disabled
          class="grid size-5 place-items-center rounded-md text-primary-warm-gray hover:text-primary-warm-white"
          :aria-label="t('reshoot.move.remove', { time: frameTime(key.frame) })"
          @click="emit('remove', key.frame)"
        >
          <X class="size-3" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>
