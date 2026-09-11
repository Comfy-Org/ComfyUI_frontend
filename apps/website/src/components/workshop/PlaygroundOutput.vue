<script setup lang="ts">
import {
  Download,
  ExternalLink,
  File as FileIcon,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  X
} from '@lucide/vue'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import VideoPlayer from '../common/VideoPlayer.vue'
import OutputTransport from './OutputTransport.vue'
import type { Modality } from '../../config/models-catalogue'
import type {
  RunFailure,
  RunOutput,
  RunRecord,
  RunState
} from '../../config/workshop-run'
import { formatElapsed, isExpired } from '../../config/workshop-run'
import { WORKSHOP_CREDITS_URL } from '../../config/workshop-env'
import { downloadOutput } from '../../config/workshop-output-download'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  state,
  now,
  modality,
  earlier = [],
  attachments = [],
  memberWorkspace,
  locale = 'en'
} = defineProps<{
  state: RunState
  now: number
  modality?: Modality
  earlier?: readonly RunRecord[]
  attachments?: readonly RunOutput[]
  memberWorkspace?: string
  locale?: Locale
}>()

const revealed = defineModel<boolean>('revealed', { default: false })

const emit = defineEmits<{
  retry: []
  useInCode: []
  switchPersonal: []
}>()

const elapsed = computed(() =>
  state.status === 'running' ? formatElapsed(now - state.startedAt) : '0:00'
)

const expanded = ref(false)
const expandTrigger = useTemplateRef<HTMLButtonElement>('expandTrigger')

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

const statusMessage = computed(() => {
  if (
    state.status === 'failed' &&
    state.reason === 'noCredits' &&
    memberWorkspace !== undefined
  )
    return t('workshop.error.memberNoCredits', locale).replace(
      '{workspace}',
      memberWorkspace
    )
  if (state.status === 'failed') return t(failureKey[state.reason], locale)
  if (state.status === 'running') return t('workshop.run.running', locale)
  if (state.status === 'cancelled')
    return t('workshop.output.cancelled', locale)
  if (state.status === 'succeeded')
    return t(
      now >= state.expiresAt
        ? 'workshop.output.expired'
        : 'workshop.output.complete',
      locale
    )
  return ''
})

const selected = ref(0)
// Earlier outputs from this visit stay reachable; the latest is the default.
const viewing = ref<RunRecord>()
const selectedAttachment = ref<RunOutput>()
const latest = computed(() =>
  state.status === 'succeeded' || state.status === 'example'
    ? state.output
    : undefined
)
const primary = computed(() => viewing.value?.output ?? latest.value)
const currentAttachments = computed(
  () => viewing.value?.attachments ?? attachments
)
const shown = computed(() => selectedAttachment.value ?? primary.value)

// Only a result the visitor produced opens full screen; the example is a
// sample of what the model makes, not their picture to inspect.
const expandable = computed(
  () => state.status === 'succeeded' && shown.value?.kind === 'image'
)
const outputs = computed(() =>
  shown.value
    ? shown.value.urls?.length
      ? shown.value.urls
      : [shown.value.url]
    : []
)
const currentUrl = computed(() => outputs.value[selected.value] ?? '')
const failedDownloadUrl = ref<string>()
const downloadNeedsLink = computed(
  () => failedDownloadUrl.value === currentUrl.value
)
async function download(event: MouseEvent) {
  if (downloadNeedsLink.value) return
  event.preventDefault()
  if (!shown.value) return
  const url = currentUrl.value
  if (!(await downloadOutput(url, shown.value.fileName)))
    failedDownloadUrl.value = url
}
watch(latest, () => {
  viewing.value = undefined
})
watch(primary, () => {
  selectedAttachment.value = undefined
})

// Earlier runs carry their own flag, so switching away from the latest output
// must not drop the gate.
const shownIsSensitive = computed(() =>
  viewing.value
    ? viewing.value.output.nsfw === true || shown.value?.nsfw === true
    : (state.status === 'succeeded' && state.nsfw) || shown.value?.nsfw === true
)
const blurred = computed(() => shownIsSensitive.value && !revealed.value)
watch(shown, () => {
  selected.value = 0
  revealed.value = false
  expanded.value = false
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
    data-testid="playground-output"
    :data-state="state.status"
  >
    <p role="status" class="sr-only">{{ statusMessage }}</p>
    <header
      class="flex items-center justify-between border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      <span>{{ t('workshop.output.title', locale) }}</span>
      <span
        v-if="state.status === 'running'"
        class="text-primary-warm-white tabular-nums"
        data-testid="run-elapsed"
      >
        {{ elapsed }}
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
        {{ statusMessage }}
      </p>
      <Button
        v-if="state.reason === 'noCredits' && memberWorkspace !== undefined"
        variant="outline"
        size="sm"
        @click="emit('switchPersonal')"
      >
        {{ t('workshop.run.switchPersonal', locale) }}
      </Button>
      <Button
        v-else-if="state.reason === 'noCredits'"
        as="a"
        :href="WORKSHOP_CREDITS_URL"
        target="_blank"
        rel="noopener noreferrer"
        variant="outline"
        size="sm"
      >
        {{ t('nav.buyCredits', locale) }}
      </Button>
      <Button
        v-else-if="state.reason !== 'validation'"
        variant="outline"
        size="sm"
        @click="emit('retry')"
      >
        {{ t('workshop.error.retry', locale) }}
      </Button>
    </div>

    <!-- Succeeded, or the example that ships with the model -->
    <template v-else-if="shown">
      <div
        class="relative aspect-video max-h-[70dvh] w-full flex-1 overflow-hidden bg-black/20"
      >
        <div
          :key="currentUrl"
          :class="blurred ? 'blur-2xl select-none' : ''"
          class="animate-soft-in size-full transition-[filter]"
        >
          <VideoPlayer
            v-if="currentUrl && shown.kind === 'video' && !blurred"
            :src="currentUrl"
            :locale
            :aria-label="t('workshop.output.title', locale)"
            class="size-full"
            fit="contain"
            controls-on-hover
            autoplay
            loop
            no-cors
          />
          <img
            v-else-if="currentUrl && shown.kind === 'image' && !blurred"
            :src="currentUrl"
            :alt="t('workshop.output.title', locale)"
            class="size-full object-contain"
          />
          <pre
            v-else-if="shown.kind === 'text' && !blurred"
            class="size-full overflow-y-auto p-5 font-mono text-sm whitespace-pre-wrap text-primary-warm-white"
            >{{ shown.text }}</pre>
          <div
            v-else-if="shown.kind === 'audio'"
            class="flex size-full items-end justify-center gap-1 p-8"
            aria-hidden="true"
          >
            <span
              v-for="bar in 32"
              :key="bar"
              class="bg-primary-comfy-yellow/70 w-1.5 rounded-full"
              :style="{ height: `${20 + ((bar * 37) % 60)}%` }"
            />
          </div>
          <div
            v-else
            class="flex size-full flex-col items-center justify-center gap-3 p-8 text-primary-warm-gray"
          >
            <FileIcon class="size-12" aria-hidden="true" />
            <span>{{ shown.fileName }}</span>
          </div>
        </div>
        <!-- Saying "example" three times over one video says it less, so it
          is marked once, on the result. -->
        <span
          v-if="state.status === 'example'"
          class="absolute top-3 right-3 z-20 inline-flex h-6 items-center rounded-lg bg-black/40 px-2 text-2xs font-bold tracking-wider text-white uppercase backdrop-blur-md"
          data-testid="output-example"
        >
          {{ t('workshop.output.example', locale) }}
        </span>

        <button
          v-if="currentUrl && !blurred && expandable"
          ref="expandTrigger"
          type="button"
          :aria-label="t('workshop.output.expand', locale)"
          :class="cn(mediaControlClass, 'absolute right-3 bottom-3')"
          data-testid="output-expand"
          @click="expanded = true"
        >
          <Maximize2 class="size-4" aria-hidden="true" />
        </button>

        <OutputTransport
          v-if="shown.kind === 'audio' && currentUrl && !blurred"
          :src="currentUrl"
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
            v-if="shown.kind === 'video'"
            :src="url"
            class="size-full object-cover"
            muted
            playsinline
            preload="metadata"
          />
          <img
            v-else-if="shown.kind === 'image'"
            :src="url"
            alt=""
            class="size-full object-cover"
          />
          <span v-else>{{ index + 1 }}</span>
        </button>
      </div>

      <div
        v-if="currentAttachments.length && !blurred"
        class="flex flex-wrap gap-2 border-t border-transparency-white-t8 px-4 py-3"
      >
        <button
          v-for="output in [primary, ...currentAttachments]"
          :key="output?.url"
          type="button"
          :aria-pressed="shown === output"
          :class="
            cn(earlierClass(shown === output), 'size-auto px-3 py-2 break-all')
          "
          @click="selectedAttachment = output"
        >
          {{ output?.fileName }}
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
          :aria-label="`${t('workshop.output.earlier', locale)} ${index + 1}`"
          :class="earlierClass(viewing === run)"
          :data-testid="`earlier-run-${index}`"
          @click="viewing = run"
        >
          <video
            v-if="run.output.kind === 'video'"
            :src="run.output.url"
            :class="cn('size-full object-cover', run.output.nsfw && 'blur-md')"
            muted
            playsinline
            preload="metadata"
          />
          <img
            v-else-if="run.output.kind === 'image'"
            :src="run.output.url"
            alt=""
            :class="cn('size-full object-cover', run.output.nsfw && 'blur-md')"
          />
          <span v-else>{{ index + 2 }}</span>
        </button>
      </div>

      <p
        v-if="shown.truncated"
        role="status"
        class="px-5 py-2 text-xs text-primary-warm-gray"
      >
        {{ t('workshop.output.truncated', locale) }}
      </p>
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
        class="flex flex-col gap-2 border-t border-transparency-white-t8 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
      >
        <p
          v-if="downloadNeedsLink && !blurred"
          role="status"
          class="w-full text-xs text-primary-warm-gray"
        >
          {{ t('workshop.output.downloadFallback', locale) }}
        </p>
        <Button
          variant="outline"
          size="sm"
          class="w-full sm:w-auto"
          data-testid="output-use-in-code"
          @click="emit('useInCode')"
        >
          {{ t('workshop.output.useInCode', locale) }}
        </Button>
        <Button
          v-if="currentUrl && !blurred"
          as="a"
          :href="currentUrl"
          :download="downloadNeedsLink ? undefined : shown.fileName"
          :prepend-icon="downloadNeedsLink ? ExternalLink : Download"
          target="_blank"
          rel="noopener"
          size="sm"
          class="w-full sm:w-auto"
          data-testid="output-download"
          @click="download"
        >
          {{
            t(
              downloadNeedsLink
                ? 'workshop.output.openOriginal'
                : 'workshop.output.download',
              locale
            )
          }}
        </Button>
      </div>
    </template>

    <DialogRoot v-model:open="expanded">
      <DialogPortal>
        <DialogContent
          v-if="currentUrl"
          class="fixed inset-0 z-100 flex items-center justify-center bg-primary-comfy-ink/90 p-6 backdrop-blur-sm"
          :aria-describedby="undefined"
          data-testid="output-expanded"
          @click.self="expanded = false"
          @close-auto-focus.prevent="expandTrigger?.focus()"
        >
          <DialogTitle class="sr-only">{{
            t('workshop.output.title', locale)
          }}</DialogTitle>
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
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </section>
</template>
