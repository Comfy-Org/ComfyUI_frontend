<script setup lang="ts">
import {
  CircleStop,
  Download,
  Film,
  LoaderCircle,
  RotateCcw,
  Scissors,
  Sparkles
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { SwapTake } from '@/composables/useOpenjutsu'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SwapWindow } from '@/lib/workshop/openjutsu/clip'

const {
  videoUrl,
  clipSeconds,
  range,
  partSeconds,
  takes,
  selected,
  current,
  rendering,
  sample,
  locale = 'en'
} = defineProps<{
  videoUrl?: string
  clipSeconds?: number
  range?: SwapWindow
  partSeconds?: number
  takes: readonly SwapTake[]
  selected: string
  current?: SwapTake
  rendering: boolean
  /** The stand-in backend is answering, so results are not real. */
  sample: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  select: [id: string]
  trim: []
  cancel: []
  reuse: [id: string]
}>()

const PHASES = {
  uploading: 'openjutsu.phase.uploading',
  starting: 'openjutsu.phase.starting',
  queued: 'openjutsu.phase.queued',
  running: 'openjutsu.phase.running',
  fetching: 'openjutsu.phase.fetching'
} as const

const player = ref<HTMLVideoElement>()
/** A finished take can be flipped back to the clip it was made from. */
const compare = ref<'result' | 'source'>('result')
watch(
  () => selected,
  () => (compare.value = 'result')
)

/** The window the player loops: the trim while editing, a take's own after. */
const shown = computed<SwapWindow | undefined>(() => {
  if (!current)
    return range && partSeconds !== undefined
      ? { start: range.start, seconds: partSeconds }
      : undefined
  return current.url && compare.value === 'result'
    ? undefined
    : { start: current.window.start, seconds: current.seconds }
})
const src = computed(() =>
  current?.url && compare.value === 'result' ? current.url : videoUrl
)

function seekToStart() {
  const video = player.value
  if (video && shown.value) video.currentTime = shown.value.start
}
function keepInside() {
  const video = player.value
  const bounds = shown.value
  if (!video || !bounds) return
  if (
    video.currentTime < bounds.start - 0.05 ||
    video.currentTime >= bounds.start + bounds.seconds
  )
    video.currentTime = bounds.start
}
watch(() => [shown.value?.start, shown.value?.seconds], seekToStart)

const takeName = (take: SwapTake) => t('openjutsu.take.name', { n: take.n })
const fileName = computed(() =>
  current ? `openjutsu-take-${current.n}.mp4` : 'openjutsu.mp4'
)

const tileClass = (id: string) =>
  cn(
    'grid aspect-video h-14 shrink-0 place-items-center overflow-hidden rounded-md bg-transparency-white-t8 transition-opacity',
    id === selected
      ? 'opacity-100 outline-2 outline-offset-2 outline-primary-warm-white'
      : 'opacity-60 hover:opacity-100'
  )
const pillClass = (active: boolean) =>
  cn(
    'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors',
    active
      ? 'bg-primary-warm-white text-primary-comfy-ink'
      : 'text-primary-comfy-canvas hover:bg-transparency-white-t8 hover:text-primary-warm-white'
  )
const outlineClass =
  'flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-primary-warm-white ring-1 ring-transparency-white-t20 transition-colors ring-inset hover:bg-transparency-white-t8'
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4" data-testid="openjutsu-stage">
    <div
      v-if="!videoUrl"
      class="mx-auto flex aspect-video w-[min(100%,calc(48svh*16/9))] flex-col items-center justify-center gap-2 rounded-md bg-transparency-white-t4 px-6 text-center ring-1 ring-transparency-white-t8"
      data-testid="openjutsu-empty"
    >
      <Sparkles class="size-8 text-primary-warm-gray" aria-hidden="true" />
      <p class="text-base text-primary-comfy-canvas">
        {{ t('openjutsu.empty.title') }}
      </p>
      <p class="text-xs text-primary-warm-gray">
        {{ t('openjutsu.empty.hint') }}
      </p>
    </div>

    <template v-else>
      <div
        class="relative mx-auto grid max-h-[48svh] w-full place-items-center overflow-hidden rounded-md bg-primary-comfy-ink ring-1 ring-transparency-white-t8"
      >
        <video
          ref="player"
          :key="src"
          :src
          controls
          playsinline
          loop
          class="max-h-[48svh] w-full object-contain"
          data-testid="openjutsu-player"
          @loadedmetadata="seekToStart"
          @timeupdate="keepInside"
        />
        <div
          v-if="current?.status === 'rendering'"
          role="status"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-primary-comfy-ink/80 px-6 text-center"
          data-testid="openjutsu-progress"
        >
          <LoaderCircle
            class="size-7 text-primary-comfy-yellow motion-safe:animate-spin"
            aria-hidden="true"
          />
          <p class="text-base font-semibold text-primary-warm-white">
            {{ t(PHASES[current.phase ?? 'running']) }}
          </p>
          <p class="max-w-sm text-xs/relaxed text-primary-warm-gray">
            {{ t('openjutsu.phase.note') }}
          </p>
          <Button
            variant="outline"
            size="sm"
            class="rounded-full"
            data-testid="openjutsu-cancel"
            @click="emit('cancel')"
          >
            {{ t('reshoot.cancel') }}
          </Button>
        </div>
        <div
          v-else-if="
            current?.status === 'failed' || current?.status === 'cancelled'
          "
          role="alert"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-primary-comfy-ink/80 px-6 text-center"
          data-testid="openjutsu-failed"
        >
          <CircleStop
            class="size-7 text-primary-comfy-canvas"
            aria-hidden="true"
          />
          <p class="max-w-md text-sm text-primary-warm-white">
            {{
              current.status === 'cancelled'
                ? t('reshoot.take.cancelled')
                : (current.note ?? t('reshoot.error.failed'))
            }}
          </p>
          <Button
            variant="outline"
            size="sm"
            class="rounded-full"
            @click="emit('reuse', current.id)"
          >
            {{ t('openjutsu.take.retry') }}
          </Button>
        </div>
      </div>

      <div
        v-if="!current && shown && clipSeconds !== undefined"
        class="flex flex-wrap items-center justify-between gap-3"
        data-testid="openjutsu-part"
      >
        <p class="text-sm text-primary-comfy-canvas">
          {{
            t('openjutsu.trim.summary', {
              from: shown.start.toFixed(1),
              to: (shown.start + shown.seconds).toFixed(1),
              seconds: shown.seconds.toFixed(1),
              total: clipSeconds.toFixed(1)
            })
          }}
        </p>
        <button type="button" :class="outlineClass" @click="emit('trim')">
          <Scissors class="size-3.5" aria-hidden="true" />
          {{ t('openjutsu.trim.edit') }}
        </button>
      </div>

      <div
        v-else-if="current?.status === 'done' && current.url"
        class="flex flex-col gap-2"
      >
        <p
          v-if="sample"
          class="rounded-xl bg-transparency-white-t8 px-3 py-2 text-xs/relaxed text-primary-warm-white"
          data-testid="openjutsu-sample-note"
        >
          {{ t('openjutsu.sample.result') }}
        </p>
        <div class="flex w-full flex-wrap items-center justify-between gap-2">
          <div
            class="flex rounded-full bg-transparency-white-t4 p-1 ring-1 ring-transparency-white-t8 ring-inset"
            role="radiogroup"
            :aria-label="t('reshoot.views')"
          >
            <button
              type="button"
              role="radio"
              :aria-checked="compare === 'result'"
              :class="pillClass(compare === 'result')"
              @click="compare = 'result'"
            >
              <Sparkles class="size-3.5" aria-hidden="true" />
              {{ t('reshoot.view.result') }}
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="compare === 'source'"
              :class="pillClass(compare === 'source')"
              @click="compare = 'source'"
            >
              <Film class="size-3.5" aria-hidden="true" />
              {{ t('reshoot.view.source') }}
            </button>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              :class="outlineClass"
              @click="emit('reuse', current.id)"
            >
              <RotateCcw class="size-3.5" aria-hidden="true" />
              {{ t('openjutsu.take.reuse') }}
            </button>
            <a
              :href="current.url"
              :download="fileName"
              :class="outlineClass"
              data-testid="openjutsu-download"
            >
              <Download class="size-3.5" aria-hidden="true" />
              {{ t('reshoot.download') }}
            </a>
          </div>
        </div>
        <p class="text-xs/relaxed text-primary-warm-gray">
          {{ t('openjutsu.take.detail', { target: current.target }) }}
          · {{ t('openjutsu.take.audio') }}
        </p>
      </div>

      <nav
        v-if="takes.length"
        :aria-label="t('reshoot.takes')"
        class="flex max-w-full items-center gap-2 overflow-x-auto p-1"
      >
        <button
          type="button"
          :aria-current="selected === 'source'"
          :aria-label="t('openjutsu.take.source')"
          :class="cn(tileClass('source'), 'text-primary-warm-white')"
          @click="emit('select', 'source')"
        >
          <Film class="size-4" aria-hidden="true" />
        </button>
        <span
          class="mx-1 h-8 w-px bg-transparency-white-t8"
          aria-hidden="true"
        />
        <button
          v-for="take in takes"
          :key="take.id"
          type="button"
          :aria-current="selected === take.id"
          :aria-label="takeName(take)"
          :class="tileClass(take.id)"
          @click="emit('select', take.id)"
        >
          <video
            v-if="take.url"
            :src="take.url"
            muted
            playsinline
            preload="metadata"
            class="size-full object-cover"
          />
          <LoaderCircle
            v-else-if="take.status === 'rendering'"
            class="size-4 text-primary-comfy-yellow motion-safe:animate-spin"
            aria-hidden="true"
          />
          <CircleStop
            v-else
            class="size-4 text-primary-comfy-canvas"
            aria-hidden="true"
          />
        </button>
        <span v-if="rendering" class="sr-only" role="status">
          {{ t('openjutsu.phase.running') }}
        </span>
      </nav>
    </template>
  </div>
</template>
