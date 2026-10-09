<script setup lang="ts">
import { Film, Scissors, Upload } from '@lucide/vue'
import { computed } from 'vue'

import EditorCollapsible from '@/components/workshop/app-editor/EditorCollapsible.vue'
import EditorPanelRow from '@/components/workshop/app-editor/EditorPanelRow.vue'
import EditorSelect from '@/components/workshop/app-editor/EditorSelect.vue'
import EditorTextArea from '@/components/workshop/app-editor/EditorTextArea.vue'
import EditorUploadSlot from '@/components/workshop/app-editor/EditorUploadSlot.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type {
  SwapCanvas,
  SwapSize,
  SwapWindow
} from '@/lib/workshop/openjutsu/clip'
import { SWAP_SIZES } from '@/lib/workshop/openjutsu/clip'
import OpenjutsuVideoInput from './OpenjutsuVideoInput.vue'

/** The panel's fields, in the order a run needs them. */
const {
  videoUrl,
  videoName,
  clipSeconds,
  range,
  partSeconds,
  savedSize,
  characterUrl,
  characterName,
  locale = 'en'
} = defineProps<{
  videoUrl?: string
  videoName?: string
  clipSeconds?: number
  range?: SwapWindow
  partSeconds?: number
  /** The frame the result is saved at, once a video is chosen. */
  savedSize?: SwapCanvas
  characterUrl?: string
  characterName?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  video: [file: File]
  character: [file: File]
  trim: []
}>()

const target = defineModel<string>('target', { required: true })
const seed = defineModel<number | undefined>('seed')
const size = defineModel<SwapSize>('size', { required: true })

const sizes = SWAP_SIZES.map((id) => ({
  id,
  label: t(`openjutsu.size.${id}`)
}))

const videoDetail = computed(() =>
  clipSeconds === undefined || range === undefined || partSeconds === undefined
    ? undefined
    : t('openjutsu.trim.summary', {
        from: range.start.toFixed(1),
        to: (range.start + partSeconds).toFixed(1),
        seconds: partSeconds.toFixed(1),
        total: clipSeconds.toFixed(1)
      })
)

/** Empty is random; a whole number, not negative, is a fixed seed. */
function setSeed(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const value = Number.parseFloat(event.target.value)
  seed.value = Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : undefined
}

const pill =
  'flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-transparency-white-t8 px-2.5 text-[11px] text-primary-comfy-canvas transition hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none'
const heading = 'px-1 text-xs text-primary-warm-gray'
</script>

<template>
  <EditorPanelRow data-testid="openjutsu-video-row">
    <h2 :class="heading">{{ t('openjutsu.video.heading') }}</h2>
    <div v-if="videoUrl" class="flex items-center gap-2.5 px-1">
      <video
        :src="videoUrl"
        muted
        playsinline
        preload="metadata"
        aria-hidden="true"
        class="aspect-video w-16 shrink-0 rounded-md bg-primary-comfy-ink object-cover"
      />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-xs font-medium text-primary-warm-white">
          {{ videoName }}
        </span>
        <span
          v-if="videoDetail"
          class="text-[11px]/snug text-primary-warm-gray"
          data-testid="openjutsu-part"
        >
          {{ videoDetail }}
        </span>
      </span>
    </div>
    <div v-if="videoUrl" class="flex gap-1.5 px-1">
      <button type="button" :class="pill" @click="emit('trim')">
        <Scissors class="size-3" aria-hidden="true" />
        {{ t('openjutsu.trim.edit') }}
      </button>
      <OpenjutsuVideoInput
        :class="pill"
        :label="t('reshoot.clip.replace')"
        @file="emit('video', $event)"
      >
        {{ t('reshoot.clip.change') }}
      </OpenjutsuVideoInput>
    </div>
    <OpenjutsuVideoInput
      v-else
      :label="t('openjutsu.video.drop')"
      class="flex items-center gap-3 rounded-lg border border-dashed border-transparency-white-t20 px-3 py-2.5 text-left hover:bg-transparency-white-t4"
      @file="emit('video', $event)"
    >
      <Film class="size-4 shrink-0 text-primary-warm-gray" aria-hidden="true" />
      <span class="flex min-w-0 flex-col">
        <span class="text-xs font-medium text-primary-warm-white">
          {{ t('openjutsu.video.drop') }}
        </span>
        <span class="text-[11px]/snug text-primary-warm-gray">
          {{ t('openjutsu.video.hint') }}
        </span>
      </span>
    </OpenjutsuVideoInput>
  </EditorPanelRow>

  <EditorPanelRow>
    <h2 :class="heading">{{ t('openjutsu.character.heading') }}</h2>
    <div class="flex items-center gap-2.5 px-1">
      <EditorUploadSlot
        :label="
          characterUrl
            ? t('reshoot.clip.change')
            : t('openjutsu.character.drop')
        "
        input-test-id="openjutsu-character-file"
        class="grid size-14 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-transparency-white-t20 text-primary-warm-gray transition hover:bg-transparency-white-t4 hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @file="emit('character', $event)"
      >
        <img
          v-if="characterUrl"
          :src="characterUrl"
          alt=""
          class="size-full object-cover"
        />
        <Upload v-else class="size-4" aria-hidden="true" />
      </EditorUploadSlot>
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-xs font-medium text-primary-warm-white">
          {{ characterName ?? t('openjutsu.character.drop') }}
        </span>
        <span class="text-[11px]/snug text-primary-warm-gray">
          {{
            characterUrl
              ? t('openjutsu.character.detail')
              : t('openjutsu.character.hint')
          }}
        </span>
      </span>
    </div>
  </EditorPanelRow>

  <EditorPanelRow>
    <EditorTextArea
      v-model="target"
      :label="t('openjutsu.target.heading')"
      :placeholder="t('openjutsu.target.placeholder')"
    />
    <p class="px-1 text-[11px]/snug text-primary-warm-gray">
      {{ t('openjutsu.target.hint') }}
    </p>
  </EditorPanelRow>

  <EditorPanelRow>
    <EditorSelect
      v-model="size"
      :label="t('openjutsu.size.label')"
      :options="sizes"
    />
    <p
      class="px-1 text-[11px]/snug text-primary-warm-gray"
      data-testid="openjutsu-saved-size"
    >
      {{
        savedSize
          ? t('openjutsu.size.saved', {
              width: savedSize.width,
              height: savedSize.height
            })
          : t('openjutsu.size.shape')
      }}
    </p>
  </EditorPanelRow>

  <EditorCollapsible :title="t('reshoot.advanced.label')">
    <label class="flex h-8 items-center gap-2 px-1">
      <span class="w-24 shrink-0 text-xs text-primary-warm-gray">
        {{ t('reshoot.seed.label') }}
      </span>
      <input
        :value="seed ?? ''"
        type="number"
        min="0"
        step="1"
        :placeholder="t('reshoot.seed.random')"
        class="h-8 min-w-0 flex-1 rounded-lg bg-transparency-white-t4 px-2.5 text-xs text-primary-warm-white tabular-nums placeholder:text-primary-warm-gray/60 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @change="setSeed"
      />
    </label>
    <p class="px-1 text-[11px]/snug text-primary-warm-gray">
      {{ t('reshoot.seed.help') }}
    </p>
  </EditorCollapsible>
</template>
