<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import OutputActions from '@/components/workshop/playground-output/OutputActions.vue'
import type { RunStop } from '@/components/workshop/playground-output/OutputEarlierRuns.vue'
import OutputEarlierRuns from '@/components/workshop/playground-output/OutputEarlierRuns.vue'
import OutputExpandedDialog from '@/components/workshop/playground-output/OutputExpandedDialog.vue'
import OutputFailed from '@/components/workshop/playground-output/OutputFailed.vue'
import OutputFileTabs from '@/components/workshop/playground-output/OutputFileTabs.vue'
import OutputIdle from '@/components/workshop/playground-output/OutputIdle.vue'
import OutputRunAgain from '@/components/workshop/playground-output/OutputRunAgain.vue'
import OutputRunning from '@/components/workshop/playground-output/OutputRunning.vue'
import OutputStage from '@/components/workshop/playground-output/OutputStage.vue'
import OutputThumbnails from '@/components/workshop/playground-output/OutputThumbnails.vue'
import type { Modality } from '@/config/models-catalogue'
import type { RunOutput, RunRecord, RunState } from '@/config/workshop-run'
import { formatElapsed, isExpired } from '@/config/workshop-run'
import { downloadOutput } from '@/config/workshop-output-download'
import { failureLabelKey } from '@/lib/workshop/failure-label'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  state,
  now,
  modality,
  earlier = [],
  attachments = [],
  retryDisabled = false,
  refreshable = false,
  memberWorkspace,
  cancelledMessage,
  policyMessage,
  compact = false,
  locale = 'en'
} = defineProps<{
  state: RunState
  now: number
  modality?: Modality
  earlier?: readonly RunRecord[]
  attachments?: readonly RunOutput[]
  retryDisabled?: boolean
  refreshable?: boolean
  memberWorkspace?: string
  /**
   * What a run stopped on purpose is called here. A model's run is abandoned
   * by the page and may still be billed; a workflow's is cancelled by Cloud
   * and is over. The same status, two different things to say.
   */
  cancelledMessage?: string
  /** Why this page's provider blocks content, when its rule is known. */
  policyMessage?: string
  /** Keeps the panel about as tall as a short form beside it. */
  compact?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const revealed = defineModel<boolean>('revealed', { default: false })

const emit = defineEmits<{
  retry: []
  useInCode: []
  switchPersonal: []
  buyCredits: []
  download: [kind: RunOutput['kind']]
  refresh: [url: string]
  delivery: [url: string, status: 'succeeded' | 'failed' | 'cancelled']
  playbackStarted: [url: string]
}>()

const elapsed = computed(() =>
  state.status === 'running' ? formatElapsed(now - state.startedAt) : '0:00'
)

const expanded = ref(false)
const stage = useTemplateRef<InstanceType<typeof OutputStage>>('stage')

const hasUnreadableFile = computed(
  () =>
    state.status === 'failed' &&
    Object.values(state.fieldErrors).includes('fileUnreadable')
)

const statusMessage = computed(() => {
  if (state.status === 'failed') return failureMessage(state)
  if (state.status === 'running')
    return state.label ?? t('workshop.run.running')
  if (state.status === 'cancelled')
    return cancelledMessage ?? t('workshop.output.cancelled')
  if (state.status === 'succeeded')
    return t(
      expired.value ? 'workshop.output.expired' : 'workshop.output.complete'
    )
  return ''
})

function failureMessage(failure: Extract<RunState, { status: 'failed' }>) {
  if (failure.reason === 'noCredits' && memberWorkspace !== undefined)
    return t('workshop.error.memberNoCredits', {
      workspace: memberWorkspace
    })
  if (failure.reason === 'policy' && policyMessage) return policyMessage
  return t(failureTranslationKey(failure))
}

function failureTranslationKey(
  failure: Extract<RunState, { status: 'failed' }>
): TranslationKey {
  if (hasUnreadableFile.value) return 'workshop.error.fileUnreadable'
  if (
    failure.reason === 'validation' &&
    !Object.keys(failure.fieldErrors).length
  )
    return 'workshop.error.inputRejected'
  return failureLabelKey[failure.reason]
}

const selected = ref(0)
// Earlier outputs from this visit stay reachable; the latest is the default.
const viewing = ref<RunRecord>()
const selectedFile = ref(0)
const latest = computed(() =>
  state.status === 'succeeded' || state.status === 'example'
    ? state.output
    : undefined
)
const primary = computed(() => viewing.value?.output ?? latest.value)
const currentAttachments = computed(
  () => viewing.value?.attachments ?? attachments
)
const files = computed(() =>
  primary.value ? [primary.value, ...currentAttachments.value] : []
)
const shown = computed(() => files.value[selectedFile.value] ?? primary.value)
const expired = computed(() =>
  shown.value?.expiresAt === undefined
    ? isExpired(state, now)
    : now >= shown.value.expiresAt
)

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
// The media element is keyed on this URL, so leaving it destroys an element
// that can no longer report. Whoever is waiting on that URL must hear it was
// abandoned, or the wait ends as a media timeout the visitor caused.
watch(currentUrl, (_, previous) => {
  if (previous) emit('delivery', previous, 'cancelled')
})
const failedDownload = ref<{ url: string; action: 'refresh' | 'open' }>()
const downloadNeedsLink = computed(
  () =>
    failedDownload.value?.url === currentUrl.value &&
    failedDownload.value?.action === 'open'
)
const downloadNeedsRefresh = computed(
  () =>
    (failedDownload.value?.url === currentUrl.value &&
      failedDownload.value?.action === 'refresh') ||
    (shown.value?.download !== undefined &&
      now >= shown.value.download.expiresAt)
)
const downloadLabel = computed(() => {
  if (downloadNeedsRefresh.value) return 'workshop.output.refreshLink'
  return downloadNeedsLink.value
    ? 'workshop.output.openOriginal'
    : 'workshop.output.download'
})
watch(shown, () => {
  failedDownload.value = undefined
})
async function download(event: MouseEvent) {
  if (!shown.value) return
  if (downloadNeedsRefresh.value) {
    event.preventDefault()
    emit('refresh', shown.value.url)
    return
  }
  emit('download', shown.value.kind)
  if (downloadNeedsLink.value || shown.value.download) return
  event.preventDefault()
  await downloadMedia(currentUrl.value, shown.value.fileName)
}

async function downloadMedia(url: string, fileName: string) {
  let unavailable = false
  if (
    !(await downloadOutput(url, fileName, {
      onUnavailable: refreshable
        ? () => {
            unavailable = true
          }
        : undefined
    }))
  ) {
    failedDownload.value = { url, action: unavailable ? 'refresh' : 'open' }
    if (unavailable && currentUrl.value === url) emit('refresh', url)
  }
}
watch(
  () => latest.value?.id ?? latest.value?.url,
  () => {
    viewing.value = undefined
  }
)
watch(
  () => primary.value?.id ?? primary.value?.url,
  () => {
    selectedFile.value = 0
  }
)

// The router reports the latest run's rating on the run, not always on the
// output, so anything showing that run has to consult both.
const latestIsSensitive = computed(
  () =>
    (state.status === 'succeeded' && state.nsfw) || latest.value?.nsfw === true
)
// Earlier runs carry their own flag, so switching away from the latest output
// must not drop the gate.
const shownIsSensitive = computed(() =>
  viewing.value
    ? viewing.value.output.nsfw === true || shown.value?.nsfw === true
    : latestIsSensitive.value || shown.value?.nsfw === true
)
const blurred = computed(() => shownIsSensitive.value && !revealed.value)
watch(
  () => shown.value?.id ?? shown.value?.url,
  () => {
    selected.value = 0
    revealed.value = false
    expanded.value = false
  }
)

// Oldest first, so the strip reads in the order the runs happened and the
// newest result is the last stop, selected by default.
const runStops = computed<RunStop[]>(() =>
  latest.value === undefined
    ? []
    : [
        ...[...earlier].reverse().map((record, index) => ({
          record,
          output: record.output,
          nsfw: record.output.nsfw === true,
          name: t('workshop.output.earlierRun', { number: index + 1 }),
          testId: `earlier-run-${index}`
        })),
        {
          record: undefined,
          output: latest.value,
          nsfw: latestIsSensitive.value,
          name: t('workshop.output.latest'),
          testId: 'earlier-latest'
        }
      ]
)

const showFileTabs = computed(
  () => currentAttachments.value.length > 0 && !blurred.value
)
const showThumbnails = computed(
  () => outputs.value.length > 1 && !blurred.value
)
const showEarlier = computed(
  () => earlier.length > 0 && state.status === 'succeeded'
)
const emptyHeightClass = computed(() => {
  if (shown.value) return undefined
  return compact ? 'min-h-72 sm:min-h-80 lg:min-h-100' : 'min-h-96'
})
</script>

<template>
  <section
    :class="
      cn(
        'flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4',
        emptyHeightClass
      )
    "
    data-testid="playground-output"
    :data-state="state.status"
  >
    <p role="status" class="sr-only">{{ statusMessage }}</p>
    <header
      class="flex items-center justify-between border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      <span class="shrink-0">{{ t('workshop.output.title') }}</span>
      <OutputFileTabs
        v-if="showFileTabs"
        :files
        :shown
        :locale
        @select="selectedFile = $event"
      />
    </header>

    <OutputIdle v-if="state.status === 'idle'" :locale />
    <OutputRunning
      v-else-if="state.status === 'running'"
      :run="state"
      :elapsed
      :modality
      :locale
    />
    <OutputRunAgain
      v-else-if="expired"
      :message="t('workshop.output.expired')"
      :hint="t('workshop.output.expiredHint')"
      :retry-disabled
      :locale
      data-testid="run-expired"
      @retry="emit('retry')"
    />
    <OutputRunAgain
      v-else-if="state.status === 'cancelled'"
      :message="statusMessage"
      :retry-disabled
      :locale
      @retry="emit('retry')"
    />
    <OutputFailed
      v-else-if="state.status === 'failed'"
      :reason="state.reason"
      :message="statusMessage"
      :member-workspace
      :has-unreadable-file="hasUnreadableFile"
      :retry-disabled
      :locale
      @retry="emit('retry')"
      @switch-personal="emit('switchPersonal')"
      @buy-credits="emit('buyCredits')"
    />

    <!-- Succeeded, or the example that ships with the model -->
    <template v-else-if="shown">
      <OutputStage
        ref="stage"
        :shown
        :url="currentUrl"
        :blurred
        :expandable
        :example="state.status === 'example'"
        :compact
        :locale
        @delivery="(url, status) => emit('delivery', url, status)"
        @playback-started="emit('playbackStarted', $event)"
        @expand="expanded = true"
        @reveal="revealed = true"
      />

      <OutputThumbnails
        v-if="showThumbnails"
        v-model="selected"
        :urls="outputs"
        :kind="shown.kind"
        :locale
      />

      <OutputEarlierRuns
        v-if="showEarlier"
        :stops="runStops"
        :viewing
        :locale
        @select="viewing = $event"
      />

      <p
        v-if="shown.truncated"
        role="status"
        class="px-5 py-2 text-xs text-primary-warm-gray"
      >
        {{ t('workshop.output.truncated') }}
      </p>
      <OutputActions
        v-if="state.status === 'succeeded'"
        :shown
        :url="currentUrl"
        :blurred
        :needs-link="downloadNeedsLink"
        :download-label="downloadLabel"
        :locale
        @use-in-code="emit('useInCode')"
        @download="download"
      />
    </template>

    <OutputExpandedDialog
      v-model:open="expanded"
      :url="currentUrl"
      :alt="shown?.alt"
      :locale
      @restore-focus="stage?.focusExpand()"
    />
  </section>
</template>
