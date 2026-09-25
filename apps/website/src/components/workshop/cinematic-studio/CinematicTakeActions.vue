<script setup lang="ts">
import { Film, ImagePlus, RotateCcw } from '@lucide/vue'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { take, locale = 'en' } = defineProps<{
  take: Extract<Take, { status: 'done' }>
  locale?: Locale
}>()

const emit = defineEmits<{
  again: []
  reference: [url: string, name: string]
  animate: [url: string, name: string]
}>()

const actionClass =
  'flex h-8 items-center gap-1.5 rounded-lg bg-primary-comfy-ink/70 px-2.5 text-[13px] text-primary-warm-white ring-1 ring-transparency-white-t20 backdrop-blur-sm ring-inset hover:bg-primary-comfy-ink'
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <button type="button" :class="actionClass" @click="emit('again')">
      <RotateCcw class="size-3.5" aria-hidden="true" />
      {{ tc('cinematic.stage.again', locale) }}
    </button>
    <button
      v-if="take.output.kind === 'image'"
      type="button"
      :class="actionClass"
      @click="emit('reference', take.output.url, take.output.fileName)"
    >
      <ImagePlus class="size-3.5" aria-hidden="true" />
      {{ tc('cinematic.stage.useAsReference', locale) }}
    </button>
    <button
      v-if="take.output.kind === 'image'"
      type="button"
      :class="actionClass"
      @click="emit('animate', take.output.url, take.output.fileName)"
    >
      <Film class="size-3.5" aria-hidden="true" />
      {{ tc('cinematic.video.animate', locale) }}
    </button>
  </div>
</template>
