<script setup lang="ts">
import { computed } from 'vue'

import type { RunState } from '../../composables/useWorkflowRun'
import type { Locale } from '../../i18n/translations'
import { tHub } from '../../i18n/hub'
import type { RunWayOut } from '../../lib/hub/run-failure'
import { runSaying, runSteps, stepReached } from '../../lib/hub/run-progress'
import Button from '../ui/button/Button.vue'
import WorkflowRunFailure from './WorkflowRunFailure.vue'
import WorkflowRunOutput from './WorkflowRunOutput.vue'
import WorkflowRunSteps from './WorkflowRunSteps.vue'

// The right half of the playground: the wait, then what came back. It is the
// same panel a model page shows, so a reader crossing from one to the other
// reads the same thing in the same place.
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

const steps = computed(() => runSteps(coldStart))

const reached = computed(() =>
  stepReached(
    state.phase,
    state.phase === 'tracking' && state.job.status === 'pending',
    steps.value.length
  )
)

const progress = computed(() => runSaying(state.phase))

const failure = computed(() => (state.phase === 'error' ? state : undefined))

const showSample = computed(() => sample && state.phase === 'idle')
</script>

<template>
  <div
    class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 lg:col-span-7"
    data-testid="workflow-run-result"
  >
    <header
      class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ tHub('workshop.output.title', locale) }}
    </header>

    <!-- The floor keeps this panel level with the form beside it. Stacked
      under the form on a phone there is nothing to keep level, and the floor
      is only an empty stretch under the result. -->
    <div class="flex flex-col gap-4 p-5 lg:min-h-80">
      <WorkflowRunSteps v-if="reached >= 0" :steps :reached :locale />

      <p v-if="progress" class="text-sm text-content-muted">
        {{ tHub(progress, locale) }}
      </p>

      <!-- A run stopped on purpose is not a failure, and says so without the
        red of one. -->
      <div
        v-if="state.phase === 'cancelled'"
        class="flex flex-col items-start gap-3 rounded-xl border border-transparency-white-t8 p-4"
        data-testid="workflow-run-cancelled"
      >
        <p class="text-sm text-content">
          {{ tHub('workshop.v2.run.cancelled', locale) }}
        </p>
        <Button variant="outline" size="sm" @click="$emit('press', 'retry')">
          {{ tHub('workshop.v2.run.runAgain', locale) }}
        </Button>
      </div>

      <WorkflowRunFailure
        v-if="failure"
        :reason="failure.reason"
        :message="failure.message"
        :job-id="failure.jobId"
        :member-workspace
        :locale
        @press="$emit('press', $event)"
      />

      <div v-if="outputs.length" class="flex flex-col gap-3">
        <WorkflowRunOutput
          v-for="output in outputs"
          :key="output.url"
          v-bind="output"
        />
      </div>

      <!-- Nothing has been made yet, so the panel shows what this workflow
        makes rather than an empty box. -->
      <img
        v-else-if="showSample"
        :src="sample"
        :alt="tHub('workshop.output.title', locale)"
        loading="lazy"
        decoding="async"
        class="aspect-video w-full rounded-xl bg-hub-surface object-cover"
        data-testid="workflow-run-sample"
      />
    </div>
  </div>
</template>
