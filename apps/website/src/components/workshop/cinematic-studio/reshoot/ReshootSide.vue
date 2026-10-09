<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'

import type { DepthState } from '@/composables/useReshoot'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import type {
  CameraKey,
  ReshootAspect,
  ReshootCamera,
  ReshootSize
} from '@/lib/workshop/cinematic-studio/reshoot'
import type { Locale } from '@/i18n/translations'
import ReshootRun from './ReshootRun.vue'
import ReshootSettings from './ReshootSettings.vue'

const {
  clip,
  clipName,
  isExample,
  camera,
  keys,
  depth,
  frames,
  clipError,
  error,
  gate,
  canGenerate,
  priceNote,
  workspaceName,
  locale = 'en'
} = defineProps<{
  clip: string
  clipName: string
  isExample: boolean
  camera: Readonly<ReshootCamera>
  keys: readonly CameraKey[]
  depth: DepthState
  /** Frames the run will use, once the clip's length is known. */
  frames?: number
  /** Why this clip cannot be used, if it cannot. */
  clipError?: string
  /** The last failed depth read, said above its Try again button. */
  error?: string
  gate: StudioGate
  canGenerate: boolean
  priceNote?: string
  workspaceName?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  aim: [patch: Partial<ReshootCamera>]
  removeKey: [frame: number]
  analyze: []
  generate: []
}>()

const upload = defineModel<File | undefined>('upload')
const aspect = defineModel<ReshootAspect>('aspect', { required: true })
const size = defineModel<ReshootSize>('size', { required: true })
const seed = defineModel<number | undefined>('seed')
const keepAim = defineModel<boolean>('keepAim', { required: true })
const frame = defineModel<number>('frame', { required: true })
const prompt = defineModel<string>('prompt', { required: true })
</script>

<template>
  <aside
    :aria-label="t('reshoot.panel')"
    class="flex min-w-0 flex-col rounded-2xl bg-primary-comfy-ink-light lg:sticky lg:top-24 lg:max-h-[calc(100svh-7rem)]"
  >
    <ReshootSettings
      v-model:upload="upload"
      v-model:aspect="aspect"
      v-model:size="size"
      v-model:seed="seed"
      v-model:keep-aim="keepAim"
      v-model:frame="frame"
      v-model:prompt="prompt"
      :clip
      :clip-name="clipName"
      :is-example="isExample"
      :camera
      :keys
      :depth
      :frames
      :clip-error="clipError"
      :locale
      class="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      @aim="emit('aim', $event)"
      @remove-key="emit('removeKey', $event)"
    />
    <footer class="rounded-b-2xl border-t border-transparency-white-t8 p-4">
      <ReshootRun
        :depth
        :error
        :gate
        :can-generate="canGenerate"
        :price-note="priceNote"
        :workspace-name="workspaceName"
        :locale
        @analyze="emit('analyze')"
        @generate="emit('generate')"
      />
    </footer>
  </aside>
</template>
