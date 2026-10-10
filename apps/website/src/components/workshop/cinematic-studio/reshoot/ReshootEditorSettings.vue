<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { Clock } from '@lucide/vue'
import { computed, ref } from 'vue'

import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'
import type { DepthState } from '@/composables/useReshoot'
import type {
  CameraKey,
  ReshootAspect,
  ReshootCamera,
  ReshootSize
} from '@/lib/workshop/cinematic-studio/reshoot'
import { clipFits } from '@/lib/workshop/cinematic-studio/reshoot'
import { fileSecondsOf } from '@/lib/workshop/cinematic-studio/reshoot-clip'
import type { Locale } from '@/i18n/translations'
import ReshootAimRig from './ReshootAimRig.vue'
import ReshootDisclosure from './ReshootDisclosure.vue'
import ReshootFormat from './ReshootFormat.vue'
import ReshootMoveControls from './ReshootMoveControls.vue'

/** The full-screen panel: the clip on top, the camera, then what to fill in and the format. */
const {
  clip,
  clipName,
  isExample,
  camera,
  keys,
  depth,
  frames,
  clipError,
  locale = 'en'
} = defineProps<{
  clip: string
  clipName: string
  isExample: boolean
  camera: Readonly<ReshootCamera>
  keys: readonly CameraKey[]
  depth: DepthState
  frames?: number
  clipError?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  aim: [patch: Partial<ReshootCamera>]
  removeKey: [frame: number]
}>()

const upload = defineModel<File | undefined>('upload')
const aspect = defineModel<ReshootAspect>('aspect', { required: true })
const size = defineModel<ReshootSize>('size', { required: true })
const seed = defineModel<number | undefined>('seed')
const keepAim = defineModel<boolean>('keepAim', { required: true })
const frame = defineModel<number>('frame', { required: true })
const prompt = defineModel<string>('prompt', { required: true })

const ready = computed(() => depth === 'ready')
const seconds = computed(() =>
  frames === undefined ? undefined : (frames / 24).toFixed(1)
)

function onSeed(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const value = Number.parseFloat(event.target.value)
  seed.value = Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : undefined
}

const rejected = ref<string>()
async function choose(file: File) {
  const length = await fileSecondsOf(file)
  if (Number.isFinite(length) && !clipFits(length)) {
    rejected.value = t('reshoot.clip.rejected', {
      name: file.name,
      seconds: length.toFixed(1)
    })
    return
  }
  rejected.value = undefined
  upload.value = file
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <EditorSourceTile
        kind="video"
        :src="clip"
        :name="isExample ? t('reshoot.pick.exampleTitle') : clipName"
        :add-label="t('reshoot.pick.upload')"
        :change-label="t('reshoot.clip.change')"
        input-test-id="reshoot-clip-file"
        @file="choose"
      >
        <span
          v-if="seconds"
          :title="t('reshoot.frames', { frames: frames ?? 0, seconds })"
          class="flex items-center gap-1.5 rounded-full bg-primary-comfy-ink/80 px-2.5 py-1 text-xs text-primary-warm-white tabular-nums"
          data-testid="reshoot-clip-length"
        >
          <Clock class="size-3.5 shrink-0" aria-hidden="true" />
          {{ t('reshoot.clip.seconds', { seconds }) }}
        </span>
      </EditorSourceTile>
      <p
        v-if="rejected ?? clipError"
        role="alert"
        data-testid="reshoot-clip-rejected"
        class="px-1 text-xs/relaxed text-primary-warm-white"
      >
        {{ rejected ?? clipError }}
      </p>
    </div>
    <ReshootAimRig
      v-model:keep-aim="keepAim"
      :clip
      :camera
      :disabled="!ready"
      quiet
      :locale
      @aim="emit('aim', $event)"
    />
    <ReshootDisclosure :label="t('reshoot.section.move')" :disabled="!ready">
      <ReshootMoveControls
        v-model:frame="frame"
        :keys
        :disabled="!ready"
        :locale
        @remove="emit('removeKey', $event)"
      />
    </ReshootDisclosure>
    <section>
      <label for="reshoot-prompt" class="sr-only">
        {{ t('reshoot.section.prompt') }}
      </label>
      <div
        class="flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 focus-within:border-primary-warm-white/60"
      >
        <textarea
          id="reshoot-prompt"
          v-model="prompt"
          rows="4"
          :placeholder="t('reshoot.prompt.box')"
          class="h-28 resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
        />
      </div>
    </section>
    <ReshootFormat v-model:aspect="aspect" v-model:size="size" :locale>
      <div
        class="col-span-2 flex h-10 items-center rounded-xl border border-transparency-white-t8 px-3 hover:border-transparency-white-t20"
      >
        <label for="reshoot-seed" class="sr-only">
          {{ t('reshoot.seed.label') }}
        </label>
        <input
          id="reshoot-seed"
          :value="seed ?? ''"
          type="number"
          min="0"
          step="1"
          :placeholder="`${t('reshoot.seed.label')} · ${t('reshoot.seed.random')}`"
          :title="t('reshoot.seed.help')"
          class="h-8 min-w-0 flex-1 bg-transparent text-sm text-primary-warm-white tabular-nums outline-none placeholder:text-primary-warm-gray"
          @change="onSeed"
        />
      </div>
    </ReshootFormat>
  </div>
</template>
