<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { LoaderCircle } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { DepthState } from '@/composables/useReshoot'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import type {
  CameraKey,
  ReshootAspect,
  ReshootCamera,
  ReshootSize
} from '@/lib/workshop/cinematic-studio/reshoot'
import type { Locale } from '@/i18n/translations'
import ReshootAdvanced from './ReshootAdvanced.vue'
import ReshootAimRig from './ReshootAimRig.vue'
import ReshootDisclosure from './ReshootDisclosure.vue'
import ReshootFormat from './ReshootFormat.vue'
import ReshootMoveControls from './ReshootMoveControls.vue'
import ReshootRunAction from './ReshootRunAction.vue'
import ReshootClipRow from './ReshootClipRow.vue'
import ReshootStep from './ReshootStep.vue'
import type { ReshootStepId } from './steps'
import { stepState } from './steps'

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
  notice,
  step,
  rendering = false,
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
  /** Why the camera cannot be aimed yet, when no button can fix it. */
  notice?: string
  step: ReshootStepId
  rendering?: boolean
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
  cancel: []
  example: []
}>()

const upload = defineModel<File | undefined>('upload')
const aspect = defineModel<ReshootAspect>('aspect', { required: true })
const size = defineModel<ReshootSize>('size', { required: true })
const seed = defineModel<number | undefined>('seed')
const keepAim = defineModel<boolean>('keepAim', { required: true })
const frame = defineModel<number>('frame', { required: true })
const prompt = defineModel<string>('prompt', { required: true })

const ready = computed(() => depth === 'ready')
const analyzing = computed(() => depth === 'analyzing')
const failed = computed(() => !!error && !ready.value && !analyzing.value)
const framesText = computed(() =>
  frames === undefined
    ? ''
    : t('reshoot.frames', {
        frames,
        seconds: (frames / 24).toFixed(1)
      })
)
const clipStatus = computed(
  () =>
    clipError ??
    (ready.value
      ? `${t('reshoot.clip.ready')} · ${framesText.value}`
      : analyzing.value
        ? t('reshoot.aim.reading')
        : framesText.value)
)
const waiting = computed(
  () =>
    notice ??
    clipError ??
    (analyzing.value ? undefined : t('reshoot.needsDepth'))
)
</script>

<template>
  <aside
    :aria-label="t('reshoot.panel')"
    class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
  >
    <ReshootStep
      :n="1"
      :title="t('reshoot.step.clip')"
      :state="stepState('clip', step)"
    >
      <template v-if="!isExample" #aside>
        <button
          type="button"
          class="ml-auto h-8 shrink-0 rounded-lg px-2.5 text-[13px] text-primary-warm-gray transition-colors hover:bg-transparency-white-t8 hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
          @click="emit('example')"
        >
          {{ t('reshoot.clip.useExample') }}
        </button>
      </template>
      <ReshootClipRow
        :clip
        :name="isExample ? t('reshoot.pick.exampleTitle') : clipName"
        :status="clipStatus"
        :locale
        @pick="upload = $event"
      />
    </ReshootStep>
    <ReshootStep
      :n="2"
      :title="t('reshoot.step.camera')"
      :state="stepState('camera', step)"
    >
      <template v-if="ready">
        <ReshootAimRig
          v-model:keep-aim="keepAim"
          :clip
          :camera
          :locale
          @aim="emit('aim', $event)"
        />
        <ReshootDisclosure :label="t('reshoot.section.move')">
          <ReshootMoveControls
            v-model:frame="frame"
            :keys
            :locale
            @remove="emit('removeKey', $event)"
          />
        </ReshootDisclosure>
      </template>
      <div
        v-else-if="failed"
        role="alert"
        class="flex items-center gap-3 rounded-xl bg-transparency-white-t8 py-2 pr-2 pl-3"
      >
        <p
          class="min-w-0 flex-1 text-xs wrap-break-word text-primary-warm-white"
        >
          {{ t('reshoot.failed') }}: {{ error }}
        </p>
        <Button
          size="sm"
          variant="outline"
          class="shrink-0 rounded-full"
          data-testid="reshoot-analyze"
          @click="emit('analyze')"
        >
          {{ t('reshoot.tryAgain') }}
        </Button>
      </div>
      <p
        v-else
        role="status"
        class="flex items-center gap-2.5 rounded-xl border border-transparency-white-t8 px-3 py-3 text-xs/relaxed text-primary-comfy-canvas"
        data-testid="reshoot-camera-waiting"
      >
        <LoaderCircle
          v-if="analyzing"
          class="size-4 shrink-0 text-primary-comfy-yellow motion-safe:animate-spin"
          aria-hidden="true"
        />
        {{ waiting ?? t('reshoot.generate.wait') }}
      </p>
    </ReshootStep>
    <ReshootStep
      :n="3"
      :title="t('reshoot.step.reshoot')"
      :state="stepState('reshoot', step)"
    >
      <ReshootFormat v-model:aspect="aspect" v-model:size="size" :locale />
      <ReshootAdvanced v-model:prompt="prompt" v-model:seed="seed" :locale />
    </ReshootStep>

    <ReshootRunAction
      :gate
      :ready
      :rendering
      :can-generate="canGenerate"
      :price-note="priceNote"
      :workspace-name="workspaceName"
      :locale
      @generate="emit('generate')"
      @cancel="emit('cancel')"
    />
  </aside>
</template>
