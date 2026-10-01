<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { MoodId } from '../../../lib/workshop/relight/lights'
import { MOOD_IDS, MOOD_LABELS } from '../../../lib/workshop/relight/lights'
import EditorTray from '../app-editor/EditorTray.vue'

const { mood, locale = 'en' } = defineProps<{
  mood: MoodId
  locale?: Locale
}>()

const emit = defineEmits<{ pick: [mood: MoodId]; close: [] }>()
</script>

<template>
  <EditorTray
    :title="lc('relight.mood', locale)"
    :close-label="lc('relight.close', locale)"
    class="max-w-100"
    @close="emit('close')"
  >
    <div
      role="radiogroup"
      :aria-label="lc('relight.mood', locale)"
      class="flex flex-wrap gap-1.5"
    >
      <button
        v-for="id in MOOD_IDS"
        :key="id"
        type="button"
        role="radio"
        :aria-checked="mood === id"
        :class="
          cn(
            'h-8 rounded-full bg-transparency-white-t4 px-3.5 text-xs text-primary-warm-white transition hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none',
            mood === id &&
              'bg-primary-comfy-yellow font-medium text-primary-comfy-ink hover:bg-primary-comfy-yellow'
          )
        "
        @click="emit('pick', id)"
      >
        {{ lc(MOOD_LABELS[id], locale) }}
      </button>
    </div>
    <p class="px-1 text-[11px] text-primary-warm-gray">
      {{ lc('relight.mood.note', locale) }}
    </p>
  </EditorTray>
</template>
