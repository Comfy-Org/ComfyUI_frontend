<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { DepthState } from '../../../../composables/useReshootRun'
import type {
  CameraKey,
  ReshootAspect,
  ReshootCamera,
  ReshootMotion,
  ReshootSize
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import ReshootAimRig from './ReshootAimRig.vue'
import ReshootDisclosure from './ReshootDisclosure.vue'
import ReshootFormat from './ReshootFormat.vue'
import ReshootMoveControls from './ReshootMoveControls.vue'

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
  rendering = false,
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
  /** The last failed analysis, said where the button is. */
  error?: string
  rendering?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  aim: [patch: Partial<ReshootCamera>]
  key: []
  removeKey: [frame: number]
  clearKeys: []
  analyze: []
  generate: []
}>()

const upload = defineModel<File | undefined>('upload')
const aspect = defineModel<ReshootAspect>('aspect', { required: true })
const size = defineModel<ReshootSize>('size', { required: true })
const seed = defineModel<number>('seed', { required: true })
const keepAim = defineModel<boolean>('keepAim', { required: true })
const frame = defineModel<number>('frame', { required: true })
const motion = defineModel<ReshootMotion>('motion', { required: true })
const prompt = defineModel<string>('prompt', { required: true })

const ready = computed(() => depth === 'ready')
const analyzing = computed(() => depth === 'analyzing')
const framesText = computed(() =>
  frames === undefined
    ? ''
    : rc('reshoot.frames', locale)
        .replace('{frames}', String(frames))
        .replace('{seconds}', (frames / 24).toFixed(1))
)

function choose(event: Event) {
  const input = event.target
  if (input instanceof HTMLInputElement && input.files?.[0])
    upload.value = input.files[0]
}
</script>

<template>
  <aside
    :aria-label="rc('reshoot.panel', locale)"
    class="flex min-w-0 flex-col rounded-2xl bg-primary-comfy-ink-light lg:sticky lg:top-24 lg:max-h-[calc(100svh-7rem)]"
  >
    <header
      class="flex items-center gap-3 border-b border-transparency-white-t8 px-4 py-3.5"
    >
      <video
        :src="clip"
        muted
        playsinline
        preload="metadata"
        class="aspect-video w-14 shrink-0 rounded-md bg-primary-comfy-ink object-cover"
      />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm font-semibold text-primary-warm-white">
          {{ isExample ? rc('reshoot.pick.exampleTitle', locale) : clipName }}
        </span>
        <span class="truncate text-[11px] text-primary-warm-gray">
          {{
            clipError ??
            (ready
              ? `${rc('reshoot.clip.ready', locale)} · ${framesText}`
              : analyzing
                ? rc('reshoot.aim.reading', locale)
                : framesText)
          }}
        </span>
      </span>
      <label
        class="flex h-7 shrink-0 cursor-pointer items-center rounded-full bg-transparency-white-t8 px-3 text-[11px] text-primary-comfy-canvas focus-within:ring-2 focus-within:ring-primary-comfy-yellow/50 hover:text-primary-warm-white"
      >
        {{ rc('reshoot.clip.change', locale) }}
        <input type="file" accept="video/*" class="sr-only" @change="choose" />
      </label>
    </header>

    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
      <ReshootAimRig
        v-model:keep-aim="keepAim"
        :clip
        :camera
        :disabled="!ready"
        :locale
        @aim="emit('aim', $event)"
      />
      <ReshootDisclosure
        :label="rc('reshoot.section.move', locale)"
        :disabled="!ready"
      >
        <ReshootMoveControls
          v-model:frame="frame"
          v-model:motion="motion"
          :frames
          :keys
          :locale
          @key="emit('key')"
          @remove="emit('removeKey', $event)"
          @clear="emit('clearKeys')"
        />
      </ReshootDisclosure>
      <ReshootFormat v-model:aspect="aspect" v-model:size="size" :locale />
      <ReshootDisclosure :label="rc('reshoot.advanced', locale)">
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1.5">
            <label
              for="reshoot-prompt"
              class="text-xs font-semibold text-primary-comfy-canvas"
            >
              {{ rc('reshoot.section.prompt', locale) }}
              <span class="font-normal text-primary-warm-gray">
                · {{ rc('reshoot.optional', locale) }}
              </span>
            </label>
            <p class="text-[11px]/relaxed text-primary-warm-gray">
              {{ rc('reshoot.promptHelp', locale) }}
            </p>
            <textarea
              id="reshoot-prompt"
              v-model="prompt"
              rows="2"
              :placeholder="rc('reshoot.prompt.placeholder', locale)"
              aria-describedby="reshoot-prompt-dialogue"
              class="field-sizing-content max-h-40 min-h-16 resize-none rounded-xl bg-transparency-white-t4 px-3.5 py-2.5 text-sm/relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-1 focus-visible:ring-primary-comfy-yellow/60"
            />
            <p
              id="reshoot-prompt-dialogue"
              class="text-[11px]/relaxed text-primary-warm-gray"
            >
              {{ rc('reshoot.prompt.dialogue', locale) }}
            </p>
          </div>
          <label class="flex items-center justify-between gap-3 text-xs">
            <span class="font-semibold text-primary-comfy-canvas">
              {{ rc('reshoot.seed', locale) }}
            </span>
            <input
              v-model.number="seed"
              type="number"
              min="0"
              class="h-9 w-28 rounded-xl bg-transparency-white-t4 px-3 font-mono text-sm text-primary-warm-white tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-primary-comfy-yellow/60"
            />
          </label>
        </div>
      </ReshootDisclosure>
    </div>

    <footer
      class="flex flex-col gap-2 rounded-b-2xl border-t border-transparency-white-t8 p-4"
    >
      <p
        v-if="error"
        role="alert"
        class="rounded-xl bg-transparency-white-t8 px-3 py-2 text-[11px] wrap-break-word text-primary-warm-white"
      >
        {{ rc('reshoot.failed', locale) }}: {{ error }}
      </p>
      <p class="text-center text-[11px] text-primary-warm-gray">
        {{
          rc(ready ? 'reshoot.generate.note' : 'reshoot.generate.wait', locale)
        }}
      </p>
      <!-- Analysis is a run of its own, so it waits to be asked for. -->
      <Button
        v-if="!ready"
        size="lg"
        class="rounded-full"
        :disabled="analyzing || !!clipError"
        data-testid="reshoot-analyze"
        @click="emit('analyze')"
      >
        {{
          rc(
            depth === 'stale' ? 'reshoot.analyzeAgain' : 'reshoot.analyze',
            locale
          )
        }}
      </Button>
      <Button
        size="lg"
        :variant="ready ? undefined : 'outline'"
        class="rounded-full"
        :disabled="!ready || rendering"
        data-testid="reshoot-action"
        @click="emit('generate')"
      >
        {{ rc('reshoot.generate', locale) }}
      </Button>
      <p v-if="!ready" class="text-center text-[11px] text-primary-warm-gray">
        {{ rc('reshoot.generate.locked', locale) }}
      </p>
    </footer>
  </aside>
</template>
