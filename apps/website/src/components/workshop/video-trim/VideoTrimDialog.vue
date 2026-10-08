<script setup lang="ts">
import { useObjectUrl, useRafFn } from '@vueuse/core'
import { LoaderCircle, Pause, Play } from '@lucide/vue'
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { VideoFacts } from '@/lib/workshop/video-trim/filmstrip'
import {
  captureFilmstrip,
  readVideoFacts
} from '@/lib/workshop/video-trim/filmstrip'
import type { TrimLimits, TrimRange } from '@/lib/workshop/video-trim/range'
import {
  initialTrim,
  tooShortToTrim,
  trimLength
} from '@/lib/workshop/video-trim/range'
import { clock, loopedTime, playFrom } from '@/lib/workshop/video-trim/track'
import VideoTrimTrack from './VideoTrimTrack.vue'

/** What Confirm hands back: the part to keep, and what was read of the video. */
export interface VideoTrim extends TrimRange, VideoFacts {}

/**
 * The step every app puts between choosing a video and using it: pick the
 * part to keep, within the lengths the app's model takes. A video too short
 * for any part cannot be confirmed. Nothing is uploaded or re-encoded here;
 * the app sends the range with the whole file.
 */
const {
  file,
  limits,
  initial,
  locale = 'en'
} = defineProps<{
  /** The video to trim; the dialog reads it when it opens. */
  file?: File
  limits: TrimLimits
  /** A range chosen earlier for this same file, to reopen on. */
  initial?: TrimRange
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [trim: VideoTrim] }>()

const TILES = 14

const shown = computed(() => (open.value ? file : undefined))
const url = useObjectUrl(shown)
const player = useTemplateRef<HTMLVideoElement>('player')

type Reading =
  | { readonly state: 'reading' }
  | { readonly state: 'unreadable' }
  | { readonly state: 'ready'; readonly facts: VideoFacts }
const reading = shallowRef<Reading>({ state: 'reading' })
const range = ref<TrimRange>({ start: 0, end: 0 })
const playhead = ref(0)
const playing = ref(false)
const tiles = ref<(string | undefined)[]>([])

const facts = computed(() =>
  reading.value.state === 'ready' ? reading.value.facts : undefined
)
const tooShort = computed(
  () => !!facts.value && tooShortToTrim(facts.value.duration, limits)
)
const canConfirm = computed(() => !!facts.value && !tooShort.value)

let job: AbortController | undefined
watch(
  url,
  async (next) => {
    job?.abort()
    reading.value = { state: 'reading' }
    tiles.value = Array.from({ length: TILES })
    playing.value = false
    if (!next) return
    const controller = new AbortController()
    job = controller
    const read = await readVideoFacts(next, controller.signal)
    if (controller.signal.aborted) return
    if (!read) {
      reading.value = { state: 'unreadable' }
      return
    }
    range.value = initialTrim(read.duration, limits, initial)
    playhead.value = range.value.start
    reading.value = { state: 'ready', facts: read }
    void captureFilmstrip(
      next,
      read,
      TILES,
      (index, image) => {
        if (!controller.signal.aborted) tiles.value[index] = image
      },
      controller.signal
    )
  },
  { immediate: true }
)

function seek(time: number) {
  playing.value = false
  player.value?.pause()
  playhead.value = time
  if (player.value) player.value.currentTime = time
}

function pause(video: HTMLVideoElement) {
  playing.value = false
  video.pause()
}
async function play(video: HTMLVideoElement) {
  const from = playFrom(playhead.value, range.value)
  if (from !== undefined) video.currentTime = from
  playing.value = true
  await video.play().catch(() => (playing.value = false))
}
async function toggle() {
  const video = player.value
  if (!video || !canConfirm.value) return
  if (playing.value) pause(video)
  else await play(video)
}

// While it plays, the part that is kept loops, so its join can be judged.
useRafFn(() => {
  const video = player.value
  if (!video || !playing.value) return
  const loop = loopedTime(video.currentTime, video.ended, range.value)
  if (loop.seekTo !== undefined) video.currentTime = loop.seekTo
  playhead.value = loop.playhead
})

const labels = computed(() => ({
  start: t('workshop.videoTrim.start'),
  end: t('workshop.videoTrim.end'),
  seek: t('workshop.videoTrim.seek'),
  time: clock
}))

function confirm() {
  if (!facts.value || !canConfirm.value) return
  emit('confirm', { ...range.value, ...facts.value })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="t('workshop.videoTrim.cancel')"
      class="flex flex-col gap-4 p-5 sm:max-w-4xl sm:p-6 lg:p-6"
      data-testid="video-trim-dialog"
    >
      <div class="flex flex-col gap-1 pr-14">
        <DialogTitle>{{ t('workshop.videoTrim.title') }}</DialogTitle>
        <DialogDescription class="text-sm text-primary-comfy-canvas/70">
          {{
            t('workshop.videoTrim.description', {
              min: limits.min,
              max: limits.max
            })
          }}
        </DialogDescription>
      </div>

      <div
        class="relative grid min-h-40 place-items-center overflow-hidden rounded-xl bg-primary-comfy-ink"
      >
        <video
          v-if="url && reading.state !== 'unreadable'"
          ref="player"
          :src="url"
          playsinline
          preload="auto"
          class="max-h-[50svh] w-full object-contain"
          data-testid="video-trim-player"
          @click="toggle"
        />
        <p
          v-if="reading.state === 'unreadable'"
          role="alert"
          class="px-6 py-10 text-center text-sm text-primary-warm-white"
        >
          {{ t('workshop.videoTrim.unreadable') }}
        </p>
        <LoaderCircle
          v-else-if="reading.state === 'reading'"
          class="absolute size-7 text-primary-comfy-yellow motion-safe:animate-spin"
          :aria-label="t('workshop.videoTrim.reading')"
        />
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          :disabled="!canConfirm"
          :aria-label="
            playing
              ? t('workshop.videoTrim.pause')
              : t('workshop.videoTrim.play')
          "
          class="grid size-16 shrink-0 cursor-pointer place-items-center rounded-lg bg-transparency-white-t8 text-primary-warm-white transition-colors outline-none hover:bg-transparency-white-t20 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow disabled:cursor-default disabled:opacity-40"
          data-testid="video-trim-play"
          @click="toggle"
        >
          <component
            :is="playing ? Pause : Play"
            class="size-6"
            aria-hidden="true"
          />
        </button>
        <VideoTrimTrack
          v-model:range="range"
          v-model:playhead="playhead"
          :duration="facts?.duration ?? 0"
          :limits
          :tiles
          :disabled="!canConfirm"
          :labels
          @seek="seek"
        />
      </div>

      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p
          v-if="tooShort && facts"
          role="alert"
          class="text-sm text-destructive-light"
          data-testid="video-trim-too-short"
        >
          {{
            t('workshop.videoTrim.tooShort', {
              seconds: facts.duration.toFixed(1),
              min: limits.min
            })
          }}
        </p>
        <p
          v-else-if="facts"
          class="font-mono text-sm text-primary-comfy-canvas tabular-nums"
          data-testid="video-trim-readout"
        >
          {{
            t('workshop.videoTrim.selected', {
              from: clock(range.start),
              to: clock(range.end),
              seconds: trimLength(range).toFixed(1),
              total: facts.duration.toFixed(1)
            })
          }}
        </p>
        <span v-else />
        <div class="flex shrink-0 items-center justify-end gap-3">
          <Button
            variant="outline"
            size="lg"
            class="px-5"
            @click="open = false"
          >
            {{ t('workshop.videoTrim.cancel') }}
          </Button>
          <Button
            size="lg"
            class="px-5"
            :disabled="!canConfirm"
            data-testid="video-trim-confirm"
            @click="confirm"
          >
            {{ t('workshop.videoTrim.confirm') }}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
