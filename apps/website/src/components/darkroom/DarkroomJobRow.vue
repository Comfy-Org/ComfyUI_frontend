<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { settingsChips } from '@/lib/darkroom/chips'
import type {
  DarkroomJob,
  DarkroomSlot,
  PendingSlot
} from '@/lib/darkroom/feed'
import { isDone, isPending } from '@/lib/darkroom/feed'
import type { DarkroomItem } from '@/lib/darkroom/store'
import { shapeRatio, TALL_RATIO } from '@/lib/darkroom/vocabulary'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

import DarkroomTile from './DarkroomTile.vue'

const {
  job,
  urls,
  canRetry,
  locale = 'en'
} = defineProps<{
  job: DarkroomJob
  urls: ReadonlyMap<string, string>
  canRetry: (key: string) => boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  open: [item: DarkroomItem]
  cancel: [slot: PendingSlot]
  retry: [key: string]
  star: [item: DarkroomItem]
  edit: [item: DarkroomItem]
  vary: [item: DarkroomItem]
  board: [item: DarkroomItem, anchor: HTMLElement]
  rerun: []
  reuse: []
  cancelAll: []
  remove: []
}>()

// An `auto` row learns it is tall once one of its images has loaded.
const measuredTall = ref(false)
const tall = computed(() =>
  job.settings.aspectRatio && job.settings.aspectRatio !== 'auto'
    ? shapeRatio(job.settings.aspectRatio) < TALL_RATIO
    : measuredTall.value
)
const busy = computed(() => job.slots.some(isPending))
const chips = computed(() => {
  const seconds = job.slots
    .filter(isDone)
    .flatMap((slot) => slot.item.stats.seconds ?? [])
  return settingsChips(t, job.settings, {
    seeds: job.slots.map((slot) => slot.seed),
    seconds: seconds.length ? Math.max(...seconds) : undefined,
    created: job.created,
    locale
  })
})
const referenceCount = computed(
  () => job.references?.length ?? job.settings.inputCount
)

function forItem(slot: DarkroomSlot, action: (item: DarkroomItem) => void) {
  if (isDone(slot)) action(slot.item)
}

const rowButton =
  'cursor-pointer rounded-xl border border-transparency-white-t20 px-3 py-2 text-xs font-bold tracking-wider text-primary-warm-white uppercase transition-colors hover:border-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink'
const quietButton =
  'cursor-pointer rounded-xl px-3 py-2 text-xs font-bold tracking-wider text-content-muted uppercase transition-colors hover:bg-transparency-white-t8 hover:text-primary-warm-white'
</script>

<template>
  <section
    class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,1fr)]"
    data-testid="darkroom-job"
  >
    <div
      :class="
        cn(
          'grid content-start gap-1.5',
          tall
            ? 'grid-cols-2 sm:grid-cols-4'
            : job.slots.length === 1
              ? 'grid-cols-1 lg:max-w-3/5'
              : 'grid-cols-2'
        )
      "
    >
      <DarkroomTile
        v-for="slot in job.slots"
        :key="slot.key"
        :tile="slot"
        :shape="job.settings.aspectRatio"
        :url="isDone(slot) ? urls.get(slot.item.id) : undefined"
        :retryable="canRetry(slot.key)"
        :locale
        @open="forItem(slot, (item) => emit('open', item))"
        @cancel="isPending(slot) && emit('cancel', slot)"
        @retry="emit('retry', slot.key)"
        @star="forItem(slot, (item) => emit('star', item))"
        @edit="forItem(slot, (item) => emit('edit', item))"
        @vary="forItem(slot, (item) => emit('vary', item))"
        @board="
          (anchor) => forItem(slot, (item) => emit('board', item, anchor))
        "
        @tall="(isTall) => (measuredTall = measuredTall || isTall)"
      />
    </div>
    <div class="self-start lg:sticky lg:top-44">
      <p
        class="mb-3 text-base/snug wrap-break-word whitespace-pre-wrap text-primary-warm-white"
      >
        {{ job.settings.prompt }}
      </p>
      <ul class="flex flex-wrap gap-1.5">
        <li
          v-for="chip in chips"
          :key="chip"
          class="rounded-lg bg-transparency-white-t8 px-2 py-0.5 text-sm text-content"
        >
          {{ chip }}
        </li>
      </ul>
      <p v-if="job.settings.system" class="mt-2.5 text-sm text-content-muted">
        {{ t('darkroom.row.styleNotes', { notes: job.settings.system }) }}
      </p>
      <div v-if="job.references?.length" class="mt-2.5 flex flex-wrap gap-1.5">
        <img
          v-for="(reference, index) in job.references"
          :key="index"
          :src="reference.url"
          :alt="t('darkroom.refs.alt', { n: index + 1 })"
          class="size-10 rounded-lg object-cover"
        />
      </div>
      <p v-else-if="referenceCount" class="mt-2.5 text-sm text-content-muted">
        {{
          t('darkroom.row.madeFrom', { count: referenceCount }, referenceCount)
        }}
      </p>
      <div class="mt-3.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          :class="rowButton"
          :title="t('darkroom.row.runAgainTitle')"
          @click="emit('rerun')"
        >
          {{ t('darkroom.row.runAgain') }}
        </button>
        <button
          type="button"
          :class="rowButton"
          :title="t('darkroom.row.reuseTitle')"
          @click="emit('reuse')"
        >
          {{ t('darkroom.row.reuse') }}
        </button>
        <button
          v-if="busy"
          type="button"
          :class="quietButton"
          :title="t('darkroom.row.cancelTitle')"
          @click="emit('cancelAll')"
        >
          {{ t('darkroom.row.cancel') }}
        </button>
        <button
          type="button"
          :class="quietButton"
          :title="t('darkroom.row.deleteTitle')"
          @click="emit('remove')"
        >
          {{ t('darkroom.row.delete') }}
        </button>
      </div>
    </div>
  </section>
</template>
