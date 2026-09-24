<script setup lang="ts">
import { Image as ImageIcon, Loader2 } from '@lucide/vue'
import { computed } from 'vue'
import { useTimestamp } from '@vueuse/core'

import type { RunState } from '../../composables/useWorkflowRun'
import { formatElapsed } from '../../config/workshop-run'
import type { Locale } from '../../i18n/translations'
import { tHub } from '../../i18n/hub'
import type { RunWayOut } from '../../lib/hub/run-failure'
import { refusalSaying } from '../../lib/hub/run-failure'
import { runHint, runSaying } from '../../lib/hub/run-progress'
import Button from '../ui/button/Button.vue'
import WorkflowRunFailure from './WorkflowRunFailure.vue'
import WorkflowRunOutput from './WorkflowRunOutput.vue'

// The right half of the playground, built to the same contract as a model's:
// one state fills the panel at a time, centred, and the result runs to the
// panel's own edges. A reader crossing from one half to the other is told the
// same things in the same places.
const {
  state,
  outputs,
  sample,
  coldStart = false,
  memberWorkspace,
  locale = 'en'
} = defineProps<{
  state: RunState
  outputs: readonly { url: string; name: string; mime: string }[]
  /** What this workflow makes, shown until a run of its own replaces it. */
  sample?: string
  /**
   * Whether this one wakes a server of its own before it can start. Shared
   * Cloud is already awake, so its wait is a queue; a cold start is a
   * different wait and is told as one.
   */
  coldStart?: boolean
  /** Passed through to the failure, which is where it changes what is said. */
  memberWorkspace?: string
  locale?: Locale
}>()

defineEmits<{ press: [RunWayOut] }>()

const now = useTimestamp({ interval: 1000 })

const queued = computed(
  () => state.phase === 'tracking' && state.job.status === 'pending'
)

/** Everything between the press of Run and an answer, told as one state. */
const waiting = computed(() =>
  'startedAt' in state ? { since: state.startedAt } : undefined
)

const elapsed = computed(() =>
  waiting.value ? formatElapsed(now.value - waiting.value.since) : '0:00'
)

const progress = computed(() => runSaying(state.phase, queued.value, coldStart))

const hint = computed(() => runHint(state.phase, queued.value, coldStart))

const failure = computed(() => (state.phase === 'error' ? state : undefined))

/**
 * The panel read out loud, for a reader who is not watching it. A model's
 * playground says where its run stands the same way; a workflow's run is the
 * same wait for the same person, so it says so too.
 */
const announcement = computed(() => {
  const refused = failure.value
  if (refused)
    return refusalSaying(refused.reason, locale, {
      message: refused.message,
      memberWorkspace
    })
  if (state.phase === 'cancelled')
    return tHub('workshop.v2.run.cancelled', locale)
  if (state.phase === 'finished')
    return tHub('workshop.output.complete', locale)
  return progress.value ? tHub(progress.value, locale) : ''
})

const showSample = computed(() => sample && state.phase === 'idle')
</script>

<template>
  <div
    class="flex min-h-96 min-w-0 flex-col overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 lg:col-span-7"
    data-testid="workflow-run-result"
    :data-state="state.phase"
  >
    <p role="status" class="sr-only" data-testid="workflow-run-said">
      {{ announcement }}
    </p>
    <header
      class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ tHub('workshop.output.title', locale) }}
    </header>

    <!-- Nothing has been made yet and there is nothing of this workflow's to
      show in its place. -->
    <div
      v-if="state.phase === 'idle' && !showSample"
      class="flex min-h-80 flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <span
        class="grid size-12 place-items-center rounded-2xl border border-dashed border-transparency-white-t20 text-primary-warm-gray"
        aria-hidden="true"
      >
        <ImageIcon class="size-5" />
      </span>
      <p class="text-sm text-primary-warm-gray">
        {{ tHub('workshop.output.placeholder', locale) }}
      </p>
    </div>

    <!-- The wait, told the way a model's playground tells it: where the run
      is now, with the count beside it. What comes after it is not news. -->
    <div
      v-else-if="waiting"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
      data-testid="workflow-run-waiting"
    >
      <Loader2
        class="size-8 text-primary-comfy-yellow motion-safe:animate-spin"
        aria-hidden="true"
      />
      <p class="flex items-baseline gap-2 text-sm text-primary-warm-white">
        <span v-if="progress">{{ tHub(progress, locale) }}</span>
        <span
          class="text-primary-warm-gray tabular-nums"
          data-testid="workflow-run-elapsed"
        >
          {{ elapsed }}
        </span>
      </p>
      <p v-if="hint" class="max-w-xs text-xs text-primary-warm-gray">
        {{ tHub(hint, locale) }}
      </p>
    </div>

    <!-- A run stopped on purpose is not a failure, and says so without the
      red of one. -->
    <div
      v-else-if="state.phase === 'cancelled'"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
      data-testid="workflow-run-cancelled"
    >
      <p class="max-w-sm text-sm text-primary-comfy-canvas">
        {{ tHub('workshop.v2.run.cancelled', locale) }}
      </p>
      <Button variant="outline" size="sm" @click="$emit('press', 'retry')">
        {{ tHub('workshop.v2.run.runAgain', locale) }}
      </Button>
    </div>

    <WorkflowRunFailure
      v-else-if="failure"
      :reason="failure.reason"
      :message="failure.message"
      :job-id="failure.jobId"
      :member-workspace
      :locale
      @press="$emit('press', $event)"
    />

    <template v-else-if="outputs.length">
      <WorkflowRunOutput
        v-for="output in outputs"
        :key="output.url"
        v-bind="output"
      />
    </template>

    <!-- What this workflow makes, marked once as the example it is, in the
      corner a model's own example is marked in. -->
    <div
      v-else
      class="relative aspect-video max-h-[70dvh] w-full flex-1 overflow-hidden bg-black/20"
    >
      <img
        :src="sample"
        :alt="tHub('workshop.output.title', locale)"
        loading="lazy"
        decoding="async"
        class="size-full object-contain"
        data-testid="workflow-run-sample"
      />
      <span
        class="absolute top-3 right-3 z-20 inline-flex h-6 items-center rounded-lg bg-black/40 px-2 text-2xs font-bold tracking-wider text-white uppercase backdrop-blur-md"
        data-testid="workflow-run-example"
      >
        {{ tHub('workshop.output.example', locale) }}
      </span>
    </div>
  </div>
</template>
