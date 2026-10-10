<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { computed, reactive, watch } from 'vue'

import EditorFrame from '@/components/workshop/app-editor/EditorFrame.vue'
import type { EditorView } from '@/components/workshop/app-editor/view'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SwapCanvas, SwapWindow } from '@/lib/workshop/openjutsu/clip'
import type { StageCompare, SwapTake } from '@/lib/workshop/openjutsu/take'
import { loopWindow, stageSource } from '@/lib/workshop/openjutsu/take'
import OpenjutsuCompare from './OpenjutsuCompare.vue'
import OpenjutsuEmptyStage from './OpenjutsuEmptyStage.vue'
import OpenjutsuPlayer from './OpenjutsuPlayer.vue'
import OpenjutsuTakeStatus from './OpenjutsuTakeStatus.vue'
import OpenjutsuTakes from './OpenjutsuTakes.vue'

/**
 * The middle of the editor: the strip of takes, then the clip being set up or
 * the take on show, in compare, result or source view. It holds no run state;
 * the one thing it keeps is when each rendering take was first seen, for the
 * clock over the player.
 */
const {
  videoUrl,
  range,
  partSeconds,
  frame,
  takes,
  selected,
  current,
  rendering,
  sample,
  view,
  locale = 'en'
} = defineProps<{
  videoUrl?: string
  range?: SwapWindow
  partSeconds?: number
  /** The saved frame, for the stage's shape. */
  frame?: SwapCanvas
  takes: readonly SwapTake[]
  selected: string
  current?: SwapTake
  rendering: boolean
  /** The stand-in backend is answering, so results are not real. */
  sample: boolean
  /** How a finished take is shown. */
  view: EditorView
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  select: [id: string]
  video: [file: File]
  cancel: []
  reuse: [id: string]
}>()

const compare = computed<StageCompare>(() =>
  view === 'result' ? 'result' : 'source'
)
const stageView = computed(() => ({
  current,
  compare: compare.value,
  videoUrl,
  range,
  partSeconds
}))
const done = computed(() =>
  current?.status === 'done' && current.url && videoUrl
    ? { result: current.url, source: videoUrl, take: current }
    : undefined
)
const source = computed(() => stageSource(stageView.value))
const part = computed(() => loopWindow(stageView.value))
const playerLabel = computed(() =>
  current?.url && view === 'result'
    ? t('openjutsu.take.detail', { target: current.target })
    : t('reshoot.clip.yours')
)

const now = useTimestamp({ interval: 1000 })
const firstSeen = reactive(new Map<string, number>())
watch(
  () => takes.filter((take) => take.status === 'rendering').map(({ id }) => id),
  (ids) => {
    ids.forEach((id) => {
      if (!firstSeen.has(id)) firstSeen.set(id, Date.now())
    })
  },
  { immediate: true }
)
const elapsedSeconds = computed(() => {
  const started = current && firstSeen.get(current.id)
  return started === undefined ? undefined : (now.value - started) / 1000
})
</script>

<template>
  <div
    class="flex size-full max-w-5xl min-w-0 flex-col gap-3"
    data-testid="openjutsu-stage"
  >
    <OpenjutsuEmptyStage
      v-if="!videoUrl"
      :locale
      @video="emit('video', $event)"
    />
    <template v-else>
      <OpenjutsuTakes
        v-if="takes.length"
        :takes
        :selected
        :rendering
        :locale
        @select="emit('select', $event)"
      />
      <div class="min-h-0 flex-1">
        <EditorFrame :width="frame?.width ?? 16" :height="frame?.height ?? 9">
          <OpenjutsuCompare
            v-if="done && view === 'compare'"
            :result="done.result"
            :source="done.source"
            :offset="done.take.window.start"
            :label="t('openjutsu.take.detail', { target: done.take.target })"
            :locale
          />
          <OpenjutsuPlayer
            v-else-if="source"
            :src="source"
            :part
            :label="playerLabel"
            :locale
          >
            <OpenjutsuTakeStatus
              :take="current"
              :elapsed-seconds
              :locale
              @cancel="emit('cancel')"
              @retry="emit('reuse', $event)"
            />
          </OpenjutsuPlayer>
        </EditorFrame>
      </div>
      <p
        v-if="sample && done"
        class="shrink-0 self-center rounded-full bg-transparency-white-t8 px-3 py-1.5 text-center text-xs/relaxed text-primary-warm-white"
        data-testid="openjutsu-sample-note"
      >
        {{ t('openjutsu.sample.result') }}
      </p>
    </template>
  </div>
</template>
