<script setup lang="ts">
import { computed } from 'vue'

import { useSignInHref } from '../../composables/useSignInHref'
import type { RunState } from '../../composables/useWorkflowRun'
import { leaveForSignIn } from '../../config/workshop-return'
import type { Locale } from '../../i18n/translations'
import type { HubKey } from '../../i18n/hub'
import { tHub } from '../../i18n/hub'
import type { WorkflowFailure } from '../../lib/hub/run-failure'
import { failureAction } from '../../lib/hub/run-failure'
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
  /**
   * The workspace whose credits this run would spend, named only when the
   * reader is a member of it rather than its owner: buying is then somebody
   * else's to do, and naming it is what makes that visible.
   */
  memberWorkspace?: string
  locale?: Locale
}>()

defineEmits<{ resume: []; retry: []; credits: []; personal: [] }>()

// The four the model half words around a model rather than a workflow are
// said again in the Hub's own copy; the rest is the same sentence either way.
const saying: Record<WorkflowFailure, HubKey> = {
  validation: 'workshop.v2.run.rejected',
  upload: 'workshop.error.upload',
  network: 'workshop.error.network',
  client: 'workshop.error.client',
  concurrency: 'workshop.error.concurrency',
  rateLimit: 'workshop.error.rateLimit',
  policy: 'workshop.v2.run.blocked',
  noCredits: 'workshop.error.noCredits',
  unavailable: 'workshop.v2.run.unavailable',
  timeout: 'workshop.error.timeout',
  provider: 'workshop.v2.run.failed',
  signedOut: 'workshop.v2.run.expired'
}

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

const action = computed(() =>
  failure.value
    ? failureAction(failure.value.reason, memberWorkspace !== undefined)
    : undefined
)

/**
 * What the failure says. The page's own sentence where it has one, and
 * otherwise the reason's, which names a workspace where the reader is not the
 * one who can add credits to it.
 */
const trouble = computed(() => {
  if (!failure.value) return ''
  if (failure.value.message) return failure.value.message
  if (failure.value.reason === 'noCredits' && memberWorkspace !== undefined)
    return tHub('workshop.error.memberNoCredits', locale).replace(
      '{workspace}',
      () => memberWorkspace
    )
  return tHub(saying[failure.value.reason], locale)
})

const signInHref = useSignInHref(locale)

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
        <Button variant="outline" size="sm" @click="$emit('retry')">
          {{ tHub('workshop.v2.run.runAgain', locale) }}
        </Button>
      </div>

      <!-- Each refusal is named, because what a reader can do about it
        differs: add credits, wait, sign in again, or nothing at all. -->
      <div
        v-if="failure"
        class="flex flex-col items-start gap-3 rounded-xl border border-primary-comfy-red/40 p-4"
        data-testid="workflow-run-error"
        :data-reason="failure.reason"
      >
        <p class="text-sm text-primary-comfy-red">{{ trouble }}</p>

        <Button
          v-if="failure.jobId"
          variant="outline"
          size="sm"
          data-testid="workflow-run-resume"
          @click="$emit('resume')"
        >
          {{ tHub('workshop.v2.run.resume', locale) }}
        </Button>

        <Button
          v-else-if="action === 'credits'"
          variant="outline"
          size="sm"
          data-testid="workflow-run-credits"
          @click="$emit('credits')"
        >
          {{ tHub('nav.buyCredits', locale) }}
        </Button>

        <Button
          v-else-if="action === 'personal'"
          variant="outline"
          size="sm"
          data-testid="workflow-run-personal"
          @click="$emit('personal')"
        >
          {{ tHub('workshop.run.switchPersonal', locale) }}
        </Button>

        <Button
          v-else-if="action === 'signIn'"
          as="a"
          variant="outline"
          size="sm"
          :href="signInHref"
          data-testid="workflow-run-signin-again"
          @click="leaveForSignIn($event, signInHref)"
        >
          {{ tHub('workshop.run.signIn', locale) }}
        </Button>

        <Button
          v-else-if="action === 'retry'"
          variant="outline"
          size="sm"
          data-testid="workflow-run-retry"
          @click="$emit('retry')"
        >
          {{ tHub('workshop.error.retry', locale) }}
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
        :alt="tHub('workshop.output.title', locale)"
        loading="lazy"
        decoding="async"
        class="aspect-video w-full rounded-xl bg-hub-surface object-cover"
        data-testid="workflow-run-sample"
      />
    </div>
  </div>
</template>
