<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import type { MoveQuality } from '../../../lib/workshop/move-anything/mock-run'
import EditorTray from '../app-editor/EditorTray.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const quality = defineModel<MoveQuality>({ required: true })
const emit = defineEmits<{ close: [] }>()

const OPTIONS = [
  { id: 'fast', name: 'move.quality.fast', hint: 'move.quality.fastHint' },
  { id: 'best', name: 'move.quality.best', hint: 'move.quality.bestHint' }
] as const
</script>

<template>
  <EditorTray
    :title="mc('move.quality', locale)"
    :close-label="mc('move.close', locale)"
    class="max-w-80"
    @close="emit('close')"
  >
    <div
      role="radiogroup"
      :aria-label="mc('move.quality', locale)"
      class="flex flex-col gap-px"
    >
      <button
        v-for="option in OPTIONS"
        :key="option.id"
        type="button"
        role="radio"
        :aria-checked="quality === option.id"
        :class="
          cn(
            'flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none',
            quality === option.id && 'bg-transparency-white-t8'
          )
        "
        @click="quality = option.id"
      >
        <span class="text-xs text-primary-warm-white">{{
          mc(option.name, locale)
        }}</span>
        <span class="text-[11px] text-primary-warm-gray">{{
          mc(option.hint, locale)
        }}</span>
      </button>
    </div>
  </EditorTray>
</template>
