<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import EditorSplitLine from '@/components/workshop/app-editor/EditorSplitLine.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import OpenjutsuPlayer from './OpenjutsuPlayer.vue'

/**
 * A take's result under the player's controls, with its source laid over the
 * left of the split. The source follows the result: same play state, offset
 * by where the swapped part starts in the clip.
 */
const {
  result,
  source,
  offset,
  label,
  locale = 'en'
} = defineProps<{
  result: string
  source: string
  /** Seconds into the source where the result's first frame comes from. */
  offset: number
  label: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const DRIFT = 0.15

const split = ref(50)
const before = useTemplateRef<HTMLVideoElement>('before')
let lead: HTMLVideoElement | undefined

function follow(main: HTMLVideoElement | undefined = lead) {
  lead = main
  const shadow = before.value
  if (!main || !shadow) return
  const at = offset + main.currentTime
  if (Math.abs(shadow.currentTime - at) > DRIFT) shadow.currentTime = at
  shadow.playbackRate = main.playbackRate
  if (main.paused) shadow.pause()
  else if (shadow.paused) void shadow.play().catch(() => undefined)
}
</script>

<template>
  <OpenjutsuPlayer :src="result" :label :locale @time="follow">
    <div class="absolute inset-0 isolate">
      <video
        ref="before"
        :src="source"
        data-overlay
        muted
        playsinline
        preload="auto"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 size-full object-contain"
        :style="{ clipPath: `inset(0 ${100 - split}% 0 0)` }"
        @loadedmetadata="follow()"
      />
      <EditorSplitLine
        v-model="split"
        :before-label="t('reshoot.view.source')"
        :after-label="t('reshoot.view.result')"
        :slider-label="t('openjutsu.compare.slider')"
      />
    </div>
  </OpenjutsuPlayer>
</template>
