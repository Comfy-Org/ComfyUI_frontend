<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import InfoTooltip from '@/components/ui/tooltip/InfoTooltip.vue'
import type { DepthState } from '@/composables/useReshoot'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import type {
  CameraKey,
  ReshootAspect,
  ReshootCamera,
  ReshootSize
} from '@/lib/workshop/cinematic-studio/reshoot'
import { clipFits } from '@/lib/workshop/cinematic-studio/reshoot'
import { fileSecondsOf } from '@/lib/workshop/cinematic-studio/reshoot-clip'
import type { Locale } from '@/i18n/translations'
import CinematicGenerateAction from '@/components/workshop/cinematic-studio/CinematicGenerateAction.vue'
import ReshootAimArea from './ReshootAimArea.vue'
import ReshootDisclosure from './ReshootDisclosure.vue'
import ReshootFormat from './ReshootFormat.vue'

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
  blocked,
  gate,
  canGenerate,
  priceNote,
  limitNote,
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
  /** What stops the depth read from starting, when nothing is running. */
  blocked?: string
  gate: StudioGate
  canGenerate: boolean
  priceNote?: string
  /** Takes left this hour, or when the next one frees up. */
  limitNote?: string
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
/** Empty is random; a number, whole and not negative, is a fixed seed. */
const seedText = computed({
  get: () => (seed.value === undefined ? '' : String(seed.value)),
  // a number field's v-model already hands over a number, or '' when empty
  set: (entry: string | number) => {
    const value = typeof entry === 'number' ? entry : Number.parseFloat(entry)
    seed.value = Number.isFinite(value)
      ? Math.max(0, Math.floor(value))
      : undefined
  }
})
const keepAim = defineModel<boolean>('keepAim', { required: true })
const frame = defineModel<number>('frame', { required: true })
const prompt = defineModel<string>('prompt', { required: true })

const ready = computed(() => depth === 'ready')
const analyzing = computed(() => depth === 'analyzing')
const framesText = computed(() =>
  frames === undefined
    ? ''
    : t('reshoot.frames', {
        frames,
        seconds: (frames / 24).toFixed(1)
      })
)

const clipStatus = computed(() => {
  if (clipError) return clipError
  if (ready.value) return `${t('reshoot.clip.ready')} · ${framesText.value}`
  return analyzing.value ? t('reshoot.aim.reading') : framesText.value
})

// A replacement is checked before it takes the current clip's place, as on
// the first pick: one outside 5 to 15 seconds is turned away and the clip
// already in use stays.
const rejected = ref<string>()
async function choose(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const seconds = await fileSecondsOf(file)
  if (Number.isFinite(seconds) && !clipFits(seconds)) {
    rejected.value = t('reshoot.clip.rejected', {
      name: file.name,
      seconds: seconds.toFixed(1)
    })
    return
  }
  rejected.value = undefined
  upload.value = file
}
</script>

<template>
  <aside
    :aria-label="t('reshoot.panel')"
    class="flex min-w-0 flex-col rounded-2xl bg-primary-comfy-ink-light lg:sticky lg:top-24 lg:max-h-[calc(100svh-7rem)]"
  >
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
      <div
        :aria-label="t('reshoot.section.video')"
        role="group"
        class="flex items-center gap-3 rounded-2xl border border-transparency-white-t8 p-2.5"
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
            {{ isExample ? t('reshoot.pick.exampleTitle') : clipName }}
          </span>
          <span class="truncate text-[11px] text-primary-warm-gray">
            {{ clipStatus }}
          </span>
        </span>
        <label
          class="flex h-7 shrink-0 cursor-pointer items-center rounded-full bg-transparency-white-t8 px-3 text-[11px] text-primary-comfy-canvas focus-within:ring-2 focus-within:ring-primary-comfy-yellow/50 hover:text-primary-warm-white"
        >
          {{ t('reshoot.clip.change') }}
          <input
            type="file"
            accept="video/*"
            class="sr-only"
            @change="choose"
          />
        </label>
      </div>
      <p
        v-if="rejected"
        role="alert"
        data-testid="reshoot-clip-rejected"
        class="-mt-2 px-1 text-[11px]/relaxed text-primary-warm-white"
      >
        {{ rejected }}
      </p>
      <ReshootAimArea
        v-model:keep-aim="keepAim"
        v-model:frame="frame"
        :clip
        :camera
        :keys
        :depth
        :reason="depth === 'failed' ? error : blocked"
        :locale
        @aim="emit('aim', $event)"
        @remove-key="emit('removeKey', $event)"
        @analyze="emit('analyze')"
      />
      <div class="flex flex-col gap-2">
        <ReshootDisclosure :label="t('reshoot.advanced.label')">
          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center gap-1.5">
                <label
                  for="reshoot-prompt"
                  class="text-xs font-semibold text-primary-comfy-canvas"
                >
                  {{ t('reshoot.section.prompt') }}
                  <span class="font-normal text-primary-warm-gray">
                    · {{ t('reshoot.optional') }}
                  </span>
                </label>
                <InfoTooltip
                  :text="t('reshoot.promptHelp')"
                  :label="t('reshoot.promptHelp')"
                />
              </div>
              <textarea
                id="reshoot-prompt"
                v-model="prompt"
                rows="2"
                :placeholder="t('reshoot.prompt.placeholder')"
                aria-describedby="reshoot-prompt-dialogue"
                class="field-sizing-content max-h-40 min-h-16 resize-none rounded-xl bg-transparency-white-t4 px-3.5 py-2.5 text-sm/relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-1 focus-visible:ring-primary-comfy-yellow/60"
              />
              <p
                id="reshoot-prompt-dialogue"
                class="text-[11px]/relaxed text-primary-warm-gray"
              >
                {{ t('reshoot.prompt.dialogue') }}
              </p>
            </div>
            <div class="flex items-center justify-between gap-3 text-xs">
              <div class="flex items-center gap-1.5">
                <label
                  for="reshoot-seed"
                  class="font-semibold text-primary-comfy-canvas"
                >
                  {{ t('reshoot.seed.label') }}
                </label>
                <InfoTooltip
                  :text="t('reshoot.seed.help')"
                  :label="t('reshoot.seed.help')"
                />
              </div>
              <input
                id="reshoot-seed"
                v-model.lazy="seedText"
                type="number"
                min="0"
                step="1"
                :placeholder="t('reshoot.seed.random')"
                class="h-9 w-28 rounded-xl bg-transparency-white-t4 px-3 font-mono text-sm text-primary-warm-white tabular-nums outline-none placeholder:font-sans placeholder:text-primary-warm-gray focus-visible:ring-1 focus-visible:ring-primary-comfy-yellow/60"
              />
            </div>
          </div>
        </ReshootDisclosure>
      </div>
      <ReshootFormat v-model:aspect="aspect" v-model:size="size" :locale />
    </div>

    <footer
      class="flex flex-col gap-3 rounded-b-2xl border-t border-transparency-white-t8 p-4"
    >
      <p
        v-if="ready || analyzing"
        class="text-center text-[11px] text-primary-warm-gray"
      >
        {{ t(ready ? 'reshoot.generate.note' : 'reshoot.generate.wait') }}
      </p>
      <p
        v-if="ready && limitNote"
        class="text-center text-xs text-primary-comfy-canvas"
        data-testid="reshoot-limit"
      >
        {{ limitNote }}
      </p>
      <p
        v-if="priceNote"
        class="text-center text-xs text-primary-comfy-canvas"
        data-testid="reshoot-price"
      >
        {{ priceNote }}
      </p>
      <Button
        v-if="gate === 'ready'"
        size="lg"
        class="rounded-full"
        :disabled="!canGenerate"
        data-testid="reshoot-action"
        @click="emit('generate')"
      >
        {{ t('reshoot.generate.label') }}
      </Button>
      <CinematicGenerateAction
        v-else
        :gate
        :workspace-name
        :rendering="false"
        :can-generate="false"
        wide
        :locale
      />
    </footer>
  </aside>
</template>
