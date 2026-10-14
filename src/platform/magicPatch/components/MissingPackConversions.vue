<template>
  <div v-if="groups.length || store.visible" class="mt-3 flex flex-col gap-3">
    <p
      v-if="registry.state.value.phase === 'error'"
      role="alert"
      class="m-0 text-sm"
    >
      {{ t('magicPatch.unavailable') }}
    </p>
    <Button
      v-if="candidates.length"
      variant="secondary"
      :disabled="store.visible"
      @click="store.offer(candidates)"
      >{{ t('magicPatch.reviewPacks') }}</Button
    >
    <p class="m-0 text-xs text-muted-foreground">
      {{ t('magicPatch.registryGuidance') }}
    </p>
    <Button variant="textonly" @click="community.show('packs')">
      {{ t('magicPatch.openRegistry') }}
    </Button>
    <WorkflowSourceProgress :jobs="store.sourceJobs" />
    <div
      v-if="store.visible"
      role="status"
      aria-live="polite"
      :aria-label="t('magicPatch.progressTitle')"
      class="flex flex-col gap-2"
      data-testid="problems-pack-conversions"
    >
      <div
        v-for="job in store.jobs"
        :key="job.revision.revision_id"
        class="flex flex-col gap-2 text-xs"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium">{{ job.revision.name }}</span>
          <template v-if="job.state.phase === 'active'">
            <DotSpinner
              v-if="
                !job.state.disconnected &&
                ['waiting_conversion', 'waiting_install'].includes(
                  job.state.request.state
                )
              "
              duration="1s"
              :size="12"
            />
            <span>{{
              t(
                job.state.request.state === 'ready' &&
                  !store.installedRevisionIds.includes(job.revision.revision_id)
                  ? 'magicPatch.verifyingInstallation'
                  : `magicPatch.states.${job.state.request.state}`
              )
            }}</span>
            <span v-if="job.state.request.stage">{{
              t(`magicPatch.stages.${job.state.request.stage}`)
            }}</span>
            <span
              v-if="job.state.request.estimated_seconds_remaining !== undefined"
              >{{
                t('magicPatch.estimate', {
                  seconds: job.state.request.estimated_seconds_remaining
                })
              }}</span
            >
            <span v-if="job.state.disconnected" role="alert">{{
              t('magicPatch.disconnected')
            }}</span>
          </template>
          <template v-else-if="job.state.phase === 'preparing'">
            <DotSpinner
              v-if="!job.state.disconnected"
              duration="1s"
              :size="12"
            />
            <span>{{
              t(`magicPatch.preparation.${job.state.acquisition.state}`)
            }}</span>
            <span v-if="job.state.disconnected" role="alert">{{
              t('magicPatch.disconnected')
            }}</span>
          </template>
          <span v-else-if="job.state.phase === 'error'" role="alert">{{
            t(
              job.state.reason && te(`magicPatch.reasons.${job.state.reason}`)
                ? `magicPatch.reasons.${job.state.reason}`
                : 'magicPatch.unavailable'
            )
          }}</span>
          <span v-else-if="job.state.phase === 'retry'" role="alert">{{
            t('magicPatch.uncertain')
          }}</span>
          <span v-else>{{ t('magicPatch.submitting') }}</span>
        </div>
        <progress
          v-if="
            (isInProgress(job) ||
              store.installedRevisionIds.includes(job.revision.revision_id)) &&
            progressPercent(job) !== undefined
          "
          :value="progressPercent(job)"
          max="100"
          :aria-valuenow="progressPercent(job)"
          aria-valuemax="100"
          :aria-valuetext="
            store.installedRevisionIds.includes(job.revision.revision_id)
              ? t('magicPatch.states.ready')
              : t('magicPatch.estimatedProgress', {
                  percent: progressPercent(job)
                })
          "
          :aria-label="
            t('magicPatch.packProgress', { pack: job.revision.name })
          "
          class="h-2 w-full accent-primary-background"
        />
        <div
          v-else-if="isInProgress(job)"
          role="progressbar"
          aria-valuemin="0"
          :aria-valuemax="progressStages.length"
          :aria-valuenow="completedStages(job)"
          :aria-valuetext="
            t('magicPatch.stageProgress', {
              completed: completedStages(job),
              total: progressStages.length
            })
          "
          :aria-label="
            t('magicPatch.packProgress', { pack: job.revision.name })
          "
          class="flex h-2 w-full gap-0.5 overflow-hidden rounded-sm"
        >
          <span
            v-for="(_, index) in progressStages"
            :key="index"
            :class="
              cn(
                'h-full flex-1',
                index < completedStages(job)
                  ? 'bg-primary-background'
                  : index === completedStages(job)
                    ? 'animate-pulse bg-primary-background/60 motion-reduce:animate-none'
                    : 'bg-interface-stroke'
              )
            "
          />
        </div>
        <span
          v-if="
            progressPercent(job) !== undefined &&
            !store.installedRevisionIds.includes(job.revision.revision_id)
          "
          class="text-muted-foreground"
        >
          {{
            t('magicPatch.estimatedProgress', { percent: progressPercent(job) })
          }}
        </span>
      </div>
      <p v-if="store.actionFailed" role="alert" class="m-0 text-xs">
        {{ t('magicPatch.actionFailed') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTimestamp } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import { useCloudNodeRegistry } from '@/platform/customNodes/composables/useCloudNodeRegistry'
import Button from '@/components/ui/button/Button.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'
import { useMagicPatchBatchStore } from '../stores/magicPatchBatchStore'
import type { PackConversion } from '../stores/magicPatchBatchStore'
import { missingPackCandidates } from '../utils/missingPackCandidates'
import { useCommunityDialog } from '@/platform/community/composables/useCommunityDialog'
import { app } from '@/scripts/app'
import { cn } from '@comfyorg/tailwind-utils'
import { estimatedConversionProgress } from '../utils/estimatedConversionProgress'
import WorkflowSourceProgress from './WorkflowSourceProgress.vue'

const { groups } = defineProps<{ groups: MissingPackGroup[] }>()
const { t, te } = useI18n()
const registry = useCloudNodeRegistry()
const store = useMagicPatchBatchStore()
const community = useCommunityDialog()
const now = useTimestamp({ interval: 1000 })
function progressPercent(job: PackConversion) {
  if (store.installedRevisionIds.includes(job.revision.revision_id)) return 100
  if (
    job.state.phase !== 'active' ||
    job.state.disconnected ||
    ['failed', 'withdrawn'].includes(job.state.request.state)
  )
    return
  return estimatedConversionProgress(
    job.observedAt,
    job.state.request.estimated_seconds_remaining,
    now.value
  )
}
const progressStages = [
  'source_preparation',
  'queued',
  'triage',
  'conversion',
  'qualification',
  'publication',
  'install',
  'verification'
]
function completedStages(job: PackConversion) {
  if (store.installedRevisionIds.includes(job.revision.revision_id))
    return progressStages.length
  if (job.state.phase !== 'active') return 0
  if (job.state.request.state === 'ready')
    return progressStages.indexOf('verification')
  return Math.max(
    1,
    progressStages.indexOf(
      job.state.request.stage ??
        (job.state.request.state === 'waiting_install' ? 'install' : 'queued')
    )
  )
}
function isInProgress(job: PackConversion) {
  const { state } = job
  if (state.phase === 'idle' || state.phase === 'submitting') return true
  if (state.phase === 'preparing') return !state.disconnected
  return (
    state.phase === 'active' &&
    !state.disconnected &&
    (['waiting_conversion', 'waiting_install'].includes(state.request.state) ||
      (state.request.state === 'ready' && store.verifying))
  )
}
const candidates = computed(() =>
  app.isGraphReady
    ? missingPackCandidates(
        app.rootGraph,
        groups,
        registry.catalog.value?.revisions ?? []
      )
    : []
)
onMounted(() => registry.load())
</script>
