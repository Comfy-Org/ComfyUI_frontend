<script setup lang="ts">
import { computed } from 'vue'

import type { RunState } from '../../composables/useWorkflowRun'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { runSaying, runSteps, stepReached } from '../../lib/hub/run-progress'
import Button from '../ui/button/Button.vue'
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
  locale?: Locale
}>()

defineEmits<{ resume: [] }>()

const steps = computed(() => runSteps(coldStart))

const reached = computed(() =>
  stepReached(
    state.phase,
    state.phase === 'tracking' && state.job.status === 'pending',
    steps.value.length
  )
)

const saying = computed(() =>
  runSaying(state.phase, steps.value[Math.max(reached.value, 0)])
)

const failure = computed(() => (state.phase === 'error' ? state : undefined))

const showSample = computed(() => sample && state.phase === 'idle')
</script>

<template>
  <div
    class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 lg:col-span-7"
    data-testid="workflow-run-output"
  >
    <header
      class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ t('workshop.output.title', locale) }}
    </header>

    <div class="flex min-h-80 flex-col gap-4 p-5">
      <WorkflowRunSteps v-if="reached >= 0" :steps :reached :locale />

      <p v-if="saying" class="text-sm text-content-muted">
        {{ t(saying, locale) }}
      </p>

      <!-- An error says which of the two things happened, because only one
        of them is safe to simply try again. -->
      <div
        v-if="failure"
        class="border-danger/40 flex flex-col gap-3 rounded-xl border p-4"
        data-testid="workflow-run-error"
      >
        <p class="text-sm text-content">{{ failure.message }}</p>
        <Button
          v-if="failure.jobId"
          variant="outline"
          size="sm"
          data-testid="workflow-run-resume"
          @click="$emit('resume')"
        >
          {{ t('workshop.v2.run.resume', locale) }}
        </Button>
      </div>

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
        :alt="t('workshop.output.title', locale)"
        loading="lazy"
        decoding="async"
        class="aspect-video w-full rounded-xl bg-hub-surface object-cover"
        data-testid="workflow-run-sample"
      />
    </div>
  </div>
</template>
