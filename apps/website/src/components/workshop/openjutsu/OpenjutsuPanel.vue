<script setup lang="ts">
import { Scissors } from '@lucide/vue'
import { computed } from 'vue'

import EditorDropZone from '@/components/workshop/app-editor/EditorDropZone.vue'
import EditorPanelRow from '@/components/workshop/app-editor/EditorPanelRow.vue'
import EditorSelect from '@/components/workshop/app-editor/EditorSelect.vue'
import EditorTextArea from '@/components/workshop/app-editor/EditorTextArea.vue'
import EditorTiles from '@/components/workshop/app-editor/EditorTiles.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type {
  SwapCanvas,
  SwapSize,
  SwapWindow
} from '@/lib/workshop/openjutsu/clip'
import { SWAP_SIZES } from '@/lib/workshop/openjutsu/clip'
import OpenjutsuSeedField from './OpenjutsuSeedField.vue'
import OpenjutsuVideoInput from './OpenjutsuVideoInput.vue'

/** The panel's fields, in the order a run needs them, once a video is chosen. */
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
  videoUrl: string
  videoName?: string
  clipSeconds?: number
  range?: SwapWindow
  partSeconds?: number
  /** The frame the result is saved at. */
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

const characterTiles = computed(() =>
  characterUrl
    ? [{ id: 'character', label: characterName ?? '', src: characterUrl }]
    : []
)
const characterUpload = computed(() =>
  characterUrl
    ? {
        label: t('openjutsu.character.change'),
        caption: t('reshoot.clip.change'),
        inputTestId: 'openjutsu-character-file'
      }
    : {
        label: t('openjutsu.character.drop'),
        caption: t('openjutsu.character.upload'),
        inputTestId: 'openjutsu-character-file'
      }
)
</script>

<template>
  <div
    role="group"
    :aria-label="t('openjutsu.video.heading')"
    class="flex items-center gap-3 px-1 pt-2 pb-1"
    data-testid="openjutsu-video-row"
  >
    <video
      :src="videoUrl"
      muted
      playsinline
      preload="metadata"
      aria-hidden="true"
      class="size-10 shrink-0 rounded-lg bg-primary-comfy-ink object-cover"
    />
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="truncate text-xs text-primary-warm-white">
        {{ videoName }}
      </span>
      <button
        v-if="videoDetail"
        type="button"
        class="flex w-fit items-start gap-1 rounded-sm text-left text-[11px]/snug text-primary-warm-gray tabular-nums transition hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        data-testid="openjutsu-part"
        @click="emit('trim')"
      >
        <Scissors class="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <span>
          <span class="sr-only">{{ t('openjutsu.trim.edit') }}:</span>
          {{ videoDetail }}
        </span>
      </button>
    </span>
    <OpenjutsuVideoInput
      :label="t('reshoot.clip.replace')"
      class="flex h-7 shrink-0 items-center rounded-full bg-transparency-white-t8 px-3 text-xs text-primary-warm-white hover:bg-transparency-white-t20"
      @file="emit('video', $event)"
    >
      {{ t('reshoot.clip.change') }}
    </OpenjutsuVideoInput>
  </div>

  <EditorPanelRow>
    <EditorDropZone
      class="flex flex-col gap-2 rounded-xl"
      @file="emit('character', $event)"
    >
      <h2 class="px-1 text-xs text-primary-warm-gray">
        {{ t('openjutsu.character.heading') }}
      </h2>
      <EditorTiles
        :model-value="characterUrl ? 'character' : undefined"
        :label="t('openjutsu.character.heading')"
        :options="characterTiles"
        aspect="square"
        :upload="characterUpload"
        @upload="emit('character', $event)"
      />
      <p class="px-1 text-[11px]/snug text-primary-warm-gray">
        {{
          characterUrl
            ? t('openjutsu.character.detail')
            : t('openjutsu.character.hint')
        }}
      </p>
    </EditorDropZone>
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
    <OpenjutsuSeedField
      v-model="seed"
      :label="t('reshoot.seed.label')"
      :random-label="t('reshoot.seed.random')"
      :shuffle-label="t('openjutsu.seed.shuffle')"
    />
  </EditorPanelRow>
</template>
