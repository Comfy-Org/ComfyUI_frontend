<script setup lang="ts">
import {
  Download,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  X
} from '@lucide/vue'
import { onKeyStroke } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import VideoPlayer from '../common/VideoPlayer.vue'
import OutputTransport from './OutputTransport.vue'
import type { Modality } from '../../config/workshop'
import { isVideoUrl } from '../../config/workshop-playground'
import type { RunFailure, RunOutput, RunState } from '../../config/workshop-run'
import { formatElapsed, isExpired } from '../../config/workshop-run'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  state,
  now,
  modality,
  earlier = [],
  locale = 'en'
} = defineProps<{
  state: RunState
  now: number
  modality?: Modality
  earlier?: readonly RunOutput[]
  locale?: Locale
}>()

const revealed = defineModel<boolean>('revealed', { default: false })

const emit = defineEmits<{
  cancel: []
  retry: []
  useInCode: []
}>()

const elapsed = computed(() =>
  state.status === 'running' ? formatElapsed(now - state.startedAt) : '0:00'
)

const expanded = ref(false)
onKeyStroke('Escape', () => (expanded.value = false))

const mediaControlClass =
  'focus-visible:ring-primary-comfy-yellow/50 grid size-8 cursor-pointer place-items-center rounded-lg bg-primary-comfy-ink/70 text-primary-warm-white backdrop-blur-sm transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-2'

const failureKey: Record<RunFailure, TranslationKey> = {
  validation: 'workshop.error.validation',
  provider: 'workshop.error.provider',
  rateLimit: 'workshop.error.rateLimit',
  policy: 'workshop.error.policy',
  noCredits: 'workshop.error.noCredits',
  unavailable: 'workshop.error.unavailable',
  timeout: 'workshop.error.timeout'
}

const selected = ref(0)
// Earlier outputs from this visit stay reachable; the latest is the default.
const viewing = ref<RunOutput>()
const latest = computed(() =>
  state.status === 'succeeded' || state.status === 'example'
    ? state.output
    : undefined
)
const shown = computed(() => viewing.value ?? latest.value)

// What the panel offers follows what the model makes, not what the mock media
// happens to be: a video or audio result gets a transport, an image only the
// room to be looked at. Both can be opened large.
const plays = computed(
  () =>
    (modality === 'video' || modality === 'audio') &&
    shown.value?.kind !== 'text'
)
const expandable = computed(
  () => modality !== 'audio' && shown.value?.kind !== 'text'
)
const outputs = computed(() =>
  shown.value
    ? shown.value.urls?.length
      ? shown.value.urls
      : [shown.value.url]
    : []
)
const currentUrl = computed(() => outputs.value[selected.value] ?? '')
watch(latest, () => {
  viewing.value = undefined
})

// Earlier runs carry their own flag, so switching away from the latest output
// must not drop the gate.
const shownIsSensitive = computed(() =>
  viewing.value
    ? viewing.value.nsfw === true
    : state.status === 'succeeded' && state.nsfw
)
const blurred = computed(() => shownIsSensitive.value && !revealed.value)
watch(shown, () => {
  selected.value = 0
  revealed.value = false
})

const earlierClass = (active: boolean) =>
  cn(
    'flex size-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 text-xs text-primary-warm-white transition-opacity',
    active
      ? 'border-primary-comfy-yellow'
      : 'border-transparent opacity-60 hover:opacity-100'
  )
</script>

<template>
  <section
    class="bg-transparency-white-t4 flex min-h-96 flex-col overflow-hidden rounded-2xl border border-transparency-white-t8"
    aria-live="polite"
    data-testid="playground-output"
    :data-state="state.status"
  >
    <header
      class="flex items-center justify-between border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-warm-gray uppercase"
    >
      <span>{{ t('workshop.output.title', locale) }}</span>
      <span
        v-if="state.status === 'running'"
        class="text-primary-warm-white tabular-nums"
        data-testid="run-elapsed"
      >
        {{ elapsed }}
      </span>
      <span
        v-else-if="state.status === 'succeeded'"
        class="text-primary-comfy-yellow"
        data-testid="run-credits-used"
      >
        {{ state.creditsUsed }} {{ t('nav.credits', locale) }}
      </span>
      <span
        v-else-if="state.status === 'example'"
        class="text-primary-warm-white"
        data-testid="output-example"
      >
        {{ t('workshop.output.example', locale) }}
      </span>
    </header>

    <!-- Idle -->
    <div
      v-if="state.status === 'idle'"
      class="flex min-h-80 flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <span
        class="grid size-12 place-items-center rounded-2xl border border-dashed border-transparency-white-t20 text-primary-warm-gray"
        aria-hidden="true"
      >
        <ImageIcon class="size-5" />
      </span>
      <p class="text-sm text-primary-warm-gray">
        {{ t('workshop.output.placeholder', locale) }}
      </p>
    </div>

    <!-- Running -->
    <div
      v-else-if="state.status === 'running'"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <Loader2
        class="text-primary-comfy-yellow size-8 animate-spin"
        aria-hidden="true"
      />
      <p class="text-sm text-primary-warm-white">
        {{ t('workshop.run.running', locale) }}
      </p>
      <p
        v-if="modality === 'video'"
        class="max-w-xs text-xs text-primary-warm-gray"
      >
        {{ t('workshop.run.videoHint', locale) }}
      </p>
      <Button
        variant="outline"
        size="sm"
        data-testid="run-cancel"
        @click="emit('cancel')"
      >
        {{ t('workshop.run.cancel', locale) }}
      </Button>
    </div>

    <!-- Expired -->
    <div
      v-else-if="isExpired(state, now)"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
      data-testid="run-expired"
    >
      <p class="text-sm text-primary-comfy-canvas">
        {{ t('workshop.output.expired', locale) }}
      </p>
      <p class="max-w-sm text-xs text-primary-warm-gray">
        {{ t('workshop.output.expiredHint', locale) }}
      </p>
      <Button variant="outline" size="sm" @click="emit('retry')">
        {{ t('workshop.output.runAgain', locale) }}
      </Button>
    </div>

    <!-- Cancelled -->
    <div
      v-else-if="state.status === 'cancelled'"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <p class="text-sm text-primary-comfy-canvas">
        {{ t('workshop.output.cancelled', locale) }}
      </p>
      <Button variant="outline" size="sm" @click="emit('retry')">
        {{ t('workshop.output.runAgain', locale) }}
      </Button>
    </div>

    <!-- Failed -->
    <div
      v-else-if="state.status === 'failed'"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
      data-testid="run-error"
      :data-reason="state.reason"
    >
      <p class="text-primary-comfy-red text-sm">
        {{ t(failureKey[state.reason], locale) }}
      </p>
      <Button
        v-if="state.reason !== 'validation'"
        variant="outline"
        size="sm"
        @click="emit('retry')"
      >
        {{ t('workshop.error.retry', locale) }}
      </Button>
    </div>

    <!-- Succeeded, or the example that ships with the model -->
    <template v-else-if="shown">
      <div class="relative flex-1 bg-primary-comfy-ink">
        <div
          :class="blurred ? 'blur-2xl select-none' : ''"
          class="size-full transition-[filter]"
        >
          <VideoPlayer
            v-if="currentUrl && isVideoUrl(currentUrl)"
            :src="currentUrl"
            :locale
            :aria-label="t('workshop.output.title', locale)"
            class="size-full max-h-128"
            fit="contain"
            autoplay
            loop
          />
          <img
            v-else-if="currentUrl && shown.kind !== 'text'"
            :src="currentUrl"
            :alt="t('workshop.output.title', locale)"
            class="size-full max-h-128 object-contain"
          />
          <pre
            v-else-if="shown.kind === 'text'"
            class="p-5 font-mono text-sm whitespace-pre-wrap text-primary-warm-white"
            >{{ shown.text }}</pre>
          <div
            v-else
            class="flex h-full min-h-48 items-end justify-center gap-1 p-8"
            aria-hidden="true"
          >
            <span
              v-for="bar in 32"
              :key="bar"
              class="bg-primary-comfy-yellow/70 w-1.5 rounded-full"
              :style="{ height: `${20 + ((bar * 37) % 60)}%` }"
            />
          </div>
        </div>
        <button
          v-if="currentUrl && !blurred && expandable && !isVideoUrl(currentUrl)"
          type="button"
          :aria-label="t('workshop.output.expand', locale)"
          :class="cn(mediaControlClass, 'absolute top-3 right-3')"
          data-testid="output-expand"
          @click="expanded = true"
        >
          <Maximize2 class="size-4" aria-hidden="true" />
        </button>

        <OutputTransport
          v-if="plays && !blurred && !isVideoUrl(currentUrl)"
          :locale
          class="absolute inset-x-0 bottom-0"
        />
        <button
          v-if="blurred"
          type="button"
          class="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 text-center"
          data-testid="output-reveal"
          @click="revealed = true"
        >
          <span class="text-sm text-primary-warm-white">
            {{ t('workshop.output.nsfw', locale) }}
          </span>
          <span
            class="text-primary-comfy-yellow text-xs font-bold tracking-wider uppercase"
          >
            {{ t('workshop.output.reveal', locale) }}
          </span>
        </button>
      </div>

      <div
        v-if="outputs.length > 1 && !blurred"
        class="grid grid-cols-4 gap-2 border-t border-transparency-white-t8 p-4 sm:grid-cols-6 lg:grid-cols-9"
        data-testid="output-thumbnails"
      >
        <button
          v-for="(url, index) in outputs"
          :key="index"
          type="button"
          :aria-label="
            t('workshop.output.select', locale).replace(
              '{n}',
              String(index + 1)
            )
          "
          :aria-pressed="index === selected"
          :data-testid="`output-thumb-${index}`"
          :class="
            cn(
              'aspect-square cursor-pointer overflow-hidden rounded-xl border-2 transition-opacity',
              index === selected
                ? 'border-primary-comfy-yellow'
                : 'border-transparent opacity-60 hover:opacity-100'
            )
          "
          @click="selected = index"
        >
          <video
            v-if="isVideoUrl(url)"
            :src="url"
            class="size-full object-cover"
            muted
            playsinline
            preload="metadata"
          />
          <img v-else :src="url" alt="" class="size-full object-cover" />
        </button>
      </div>

      <div
        v-if="earlier.length && state.status === 'succeeded'"
        class="flex items-center gap-2 overflow-x-auto border-t border-transparency-white-t8 px-4 py-3"
        data-testid="earlier-runs"
      >
        <span
          class="shrink-0 text-2xs font-bold tracking-wider text-primary-warm-gray uppercase"
        >
          {{ t('workshop.output.earlier', locale) }}
        </span>
        <button
          type="button"
          :aria-pressed="!viewing"
          :class="cn(earlierClass(!viewing), 'w-auto px-3')"
          data-testid="earlier-latest"
          @click="viewing = undefined"
        >
          {{ t('workshop.output.latest', locale) }}
        </button>
        <button
          v-for="(run, index) in earlier"
          :key="index"
          type="button"
          :aria-pressed="viewing === run"
          :class="earlierClass(viewing === run)"
          :data-testid="`earlier-run-${index}`"
          @click="viewing = run"
        >
          <video
            v-if="isVideoUrl(run.url)"
            :src="run.url"
            :class="cn('size-full object-cover', run.nsfw && 'blur-md')"
            muted
            playsinline
            preload="metadata"
          />
          <img
            v-else-if="run.kind !== 'text'"
            :src="run.url"
            alt=""
            :class="cn('size-full object-cover', run.nsfw && 'blur-md')"
          />
          <span v-else>{{ index + 2 }}</span>
        </button>
      </div>

      <p
        class="border-t border-transparency-white-t8 px-5 py-2 text-xs text-primary-warm-gray"
        :data-testid="
          state.status === 'example' ? 'output-example-hint' : undefined
        "
      >
        {{
          state.status === 'example'
            ? t('workshop.output.exampleHint', locale)
            : t('workshop.output.expires', locale)
        }}
      </p>
      <div
        v-if="state.status === 'succeeded'"
        class="flex flex-wrap items-center justify-end gap-2 border-t border-transparency-white-t8 p-4"
      >
        <Button
          variant="outline"
          size="sm"
          data-testid="output-use-in-code"
          @click="emit('useInCode')"
        >
          {{ t('workshop.output.useInCode', locale) }}
        </Button>
        <Button
          v-if="currentUrl"
          as="a"
          :href="currentUrl"
          :download="shown.fileName"
          :prepend-icon="Download"
          size="sm"
          data-testid="output-download"
        >
          {{ t('workshop.output.download', locale) }}
        </Button>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="expanded && currentUrl"
        class="fixed inset-0 z-100 flex items-center justify-center bg-primary-comfy-ink/90 p-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        data-testid="output-expanded"
        @click.self="expanded = false"
      >
        <button
          type="button"
          :aria-label="t('workshop.output.collapse', locale)"
          :class="cn(mediaControlClass, 'absolute top-6 right-6')"
          data-testid="output-collapse"
          @click="expanded = false"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
        <img
          :src="currentUrl"
          :alt="t('workshop.output.title', locale)"
          class="max-h-full max-w-full rounded-2xl object-contain"
        />
      </div>
    </Teleport>
  </section>
</template>
