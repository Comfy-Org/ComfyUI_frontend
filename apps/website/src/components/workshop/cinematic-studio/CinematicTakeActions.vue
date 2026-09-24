<script setup lang="ts">
import { ImagePlus, RotateCcw } from '@lucide/vue'

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
}>()

const actionClass =
  'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-primary-comfy-canvas ring-1 ring-transparency-white-t8 ring-inset hover:bg-transparency-white-t4 hover:text-primary-warm-white'
</script>

<template>
  <div class="flex items-center gap-1.5">
    <button type="button" :class="actionClass" @click="emit('again')">
      <RotateCcw class="size-3.5" aria-hidden="true" />
      {{ tc('cinematic.stage.again', locale) }}
    </button>
    <button
      type="button"
      :class="actionClass"
      @click="emit('reference', take.output.url, take.output.fileName)"
    >
      <ImagePlus class="size-3.5" aria-hidden="true" />
      {{ tc('cinematic.stage.useAsReference', locale) }}
    </button>
  </div>
</template>
