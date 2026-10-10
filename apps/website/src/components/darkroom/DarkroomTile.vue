<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DarkroomSlot } from '@/lib/darkroom/feed'
import { downloadName } from '@/lib/darkroom/feed'
import { startLoadingTile, stopLoadingTile } from '@/lib/darkroom/shader'
import { shapeRatio, TALL_RATIO } from '@/lib/darkroom/vocabulary'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

import DarkroomStarIcon from './DarkroomStarIcon.vue'

const {
  tile,
  shape,
  url,
  retryable,
  locale = 'en'
} = defineProps<{
  tile: DarkroomSlot
  /** The shape asked for, which reserves the tile's space until it loads. */
  shape: string
  url?: string
  retryable: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  open: []
  cancel: []
  retry: []
  star: []
  edit: []
  vary: []
  board: [anchor: HTMLElement]
  tall: [tall: boolean]
}>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const naturalRatio = ref<number>()
const shown = ref(false)
const now = ref(Date.now())
useIntervalFn(() => {
  now.value = Date.now()
}, 1000)

const ratio = computed(() => naturalRatio.value ?? shapeRatio(shape))

watch(
  [canvas, () => tile.status],
  ([element], _previous, onCleanup) => {
    if (!element || tile.status !== 'pending') return
    startLoadingTile(element, shapeRatio(shape), tile.seed)
    onCleanup(() => stopLoadingTile(element))
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  if (canvas.value) stopLoadingTile(canvas.value)
})

const label = computed(() => {
  if (tile.status !== 'pending') return ''
  if (tile.phase === 'running')
    return t('darkroom.tile.developing', {
      seconds: Math.max(0, Math.round((now.value - tile.startedAt) / 1000))
    })
  if (tile.phase === 'saving') return t('darkroom.tile.saving')
  if (tile.phase === 'queued')
    return tile.ahead
      ? t('darkroom.tile.inLine', { count: tile.ahead })
      : t('darkroom.tile.nextUp')
  return t('darkroom.tile.sending')
})

function loaded(event: Event) {
  const image = event.target
  if (image instanceof HTMLImageElement && image.naturalWidth) {
    naturalRatio.value = image.naturalWidth / image.naturalHeight
    emit('tall', naturalRatio.value < TALL_RATIO)
  }
  shown.value = true
}

function board(event: Event) {
  if (event.currentTarget instanceof HTMLElement)
    emit('board', event.currentTarget)
}

const overlayButton =
  'cursor-pointer rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink/85 px-2.5 py-1.5 text-xs font-bold tracking-wider text-primary-warm-white uppercase no-underline hover:bg-primary-warm-white hover:text-primary-comfy-ink'
</script>

<template>
  <div
    :class="
      cn(
        'group/tile relative overflow-hidden rounded-xl bg-site-bg-soft',
        tile.status === 'done' && 'cursor-zoom-in',
        tile.status === 'error' &&
          'flex flex-col items-start justify-center gap-2 overflow-auto p-5'
      )
    "
    :style="{ aspectRatio: String(ratio) }"
    :data-testid="`darkroom-tile-${tile.status}`"
    @click="tile.status === 'done' && emit('open')"
  >
    <template v-if="tile.status === 'pending'">
      <canvas
        ref="canvas"
        :class="
          cn(
            'absolute inset-0 block size-full transition-opacity duration-500',
            tile.phase !== 'running' && 'opacity-40'
          )
        "
      />
      <span
        class="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink/55 px-2.5 py-1 text-xs font-bold tracking-wider text-primary-warm-white uppercase"
      >
        <span
          class="size-1.5 shrink-0 rounded-full bg-primary-comfy-orange motion-safe:animate-pulse"
        />
        {{ label }}
      </span>
      <button
        type="button"
        :class="
          cn(
            overlayButton,
            'absolute right-2.5 bottom-2.5 opacity-0 transition-opacity group-hover/tile:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'
          )
        "
        :title="t('darkroom.tile.cancelTitle')"
        @click.stop="emit('cancel')"
      >
        {{ t('darkroom.tile.cancel') }}
      </button>
    </template>

    <template v-else-if="tile.status === 'done'">
      <img
        v-if="url"
        :src="url"
        :alt="tile.item.settings.prompt"
        :class="
          cn(
            'block size-full object-cover',
            tile.fresh &&
              'motion-safe:transition-[opacity,filter,scale] motion-safe:duration-1000',
            tile.fresh &&
              !shown &&
              'motion-safe:scale-105 motion-safe:opacity-0 motion-safe:blur-lg'
          )
        "
        @load="loaded"
        @error="shown = true"
      />
      <span
        class="absolute top-2 left-2 rounded-lg bg-primary-comfy-ink/75 px-2 py-0.5 text-xs text-primary-warm-white opacity-0 transition-opacity group-hover/tile:opacity-100"
      >
        {{
          t('darkroom.tile.seedTag', {
            seed: tile.seed,
            seconds: tile.item.stats.seconds ?? '?'
          })
        }}
      </span>
      <button
        type="button"
        :class="
          cn(
            'absolute top-2 right-2 flex size-8 cursor-pointer items-center justify-center rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink/75 transition-opacity focus-visible:opacity-100 pointer-coarse:opacity-100',
            tile.item.starred
              ? 'text-primary-comfy-yellow'
              : 'text-primary-warm-white opacity-0 group-hover/tile:opacity-100 hover:bg-primary-warm-white hover:text-primary-comfy-ink'
          )
        "
        :aria-pressed="!!tile.item.starred"
        :title="t('darkroom.tile.starTitle')"
        :aria-label="t('darkroom.tile.star')"
        @click.stop="emit('star')"
      >
        <DarkroomStarIcon :filled="!!tile.item.starred" class="size-4" />
      </button>
      <div
        class="absolute inset-x-0 bottom-0 hidden flex-wrap justify-end gap-1.5 bg-linear-to-b from-transparent to-black/60 p-2 opacity-0 transition-opacity group-focus-within/tile:opacity-100 group-hover/tile:opacity-100 sm:flex pointer-coarse:opacity-100"
      >
        <button
          type="button"
          :class="overlayButton"
          :title="t('darkroom.tile.editTitle')"
          @click.stop="emit('edit')"
        >
          {{ t('darkroom.tile.edit') }}
        </button>
        <button
          type="button"
          :class="overlayButton"
          :title="t('darkroom.tile.variationsTitle')"
          @click.stop="emit('vary')"
        >
          {{ t('darkroom.tile.variations') }}
        </button>
        <button
          type="button"
          :class="overlayButton"
          :title="t('darkroom.tile.boardTitle')"
          data-darkroom-menu-anchor
          @click.stop="board"
        >
          {{ t('darkroom.tile.board') }}
        </button>
        <a
          v-if="url"
          :href="url"
          :download="downloadName(tile.item)"
          :class="overlayButton"
          @click.stop
        >
          {{ t('darkroom.tile.download') }}
        </a>
      </div>
    </template>

    <template v-else>
      <span
        class="inline-flex items-center gap-1.5 rounded-xl border border-transparency-white-t20 px-2.5 py-1 text-xs font-bold tracking-wider text-primary-warm-white uppercase"
      >
        <span
          :class="
            cn(
              'size-1.5 shrink-0 rounded-full',
              tile.cancelled ? 'bg-content-muted' : 'bg-destructive-light'
            )
          "
        />
        {{
          tile.cancelled
            ? t('darkroom.tile.cancelled')
            : t('darkroom.tile.failed')
        }}
      </span>
      <p class="text-base text-primary-warm-white">
        {{ t(`darkroom.failure.${tile.failure}.title`) }}
      </p>
      <p class="text-sm/snug text-content-muted">
        {{ t(`darkroom.failure.${tile.failure}.message`) }}
      </p>
      <button
        v-if="retryable"
        type="button"
        class="cursor-pointer rounded-xl border border-transparency-white-t20 px-3 py-2 text-xs font-bold tracking-wider text-primary-warm-white uppercase hover:border-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink"
        @click.stop="emit('retry')"
      >
        {{ t('darkroom.tile.tryAgain') }}
      </button>
      <details v-if="tile.detail" class="w-full text-xs text-content-muted">
        <summary class="cursor-pointer">
          {{ t('darkroom.tile.details') }}
        </summary>
        <pre
          class="mt-1.5 max-h-28 overflow-auto text-xs wrap-break-word whitespace-pre-wrap text-content"
          >{{ tile.detail }}</pre>
      </details>
    </template>
  </div>
</template>
