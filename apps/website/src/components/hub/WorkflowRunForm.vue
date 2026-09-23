<script setup lang="ts">
import { computed } from 'vue'

import { useSignInHref } from '../../composables/useSignInHref'
import { useWorkflowRun } from '../../composables/useWorkflowRun'
import type { WorkflowGraph } from '../../config/workflow-execution'
import type { WorkflowField } from '../../config/workflow-fields'
import { leaveForSignIn } from '../../config/workshop-return'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { runSaying, runSteps, stepReached } from '../../lib/hub/run-progress'
import Button from '../ui/button/Button.vue'
import WorkflowRunField from './WorkflowRunField.vue'
import WorkflowRunOutput from './WorkflowRunOutput.vue'
import WorkflowRunSteps from './WorkflowRunSteps.vue'

// The workflow, run where it actually runs. Cloud takes the whole graph in the
// request, so the page fills in the answers the bindings name and sends it;
// there is no per-workflow endpoint to wait for.
const {
  fields,
  graph,
  sample,
  coldStart = false,
  locale = 'en'
} = defineProps<{
  fields: readonly WorkflowField[]
  graph: WorkflowGraph
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

const {
  state,
  values,
  files,
  outputs,
  busy,
  session,
  settled,
  run,
  resume,
  cancel
} = useWorkflowRun(fields, graph)

const signInHref = useSignInHref(locale)

const address = (field: WorkflowField) => `${field.node}.${field.input}`

const steps = computed(() => runSteps(coldStart))

const reached = computed(() =>
  stepReached(
    state.value.phase,
    state.value.phase === 'tracking' && state.value.job.status === 'pending',
    steps.value.length
  )
)

const saying = computed(() =>
  runSaying(state.value.phase, steps.value[Math.max(reached.value, 0)])
)
</script>

<template>
  <!-- Input on the left, output on the right, headed and boxed the way a
    model's playground is. A workflow asks different questions, but a reader
    crossing from one to the other should not have to learn a second page. -->
  <section class="grid gap-8 lg:grid-cols-12" data-testid="workflow-run-form">
    <div
      class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 lg:col-span-5"
      data-testid="workflow-run-input"
    >
      <header
        class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ t('workshop.input.title', locale) }}
      </header>

      <div class="flex flex-col gap-8 p-5" data-testid="workflow-run-inputs">
        <WorkflowRunField
          v-for="field in fields"
          :key="address(field)"
          v-model="values[address(field)]"
          v-model:file="files[address(field)]"
          :field
          :name="address(field)"
          :disabled="busy"
          :locale
        />
      </div>

      <!-- Run follows the form down, so a long list of inputs never pushes it
        past the bottom of a laptop screen. -->
      <div
        class="sticky bottom-0 z-10 mt-auto flex flex-col gap-2 rounded-b-2xl border-t border-transparency-white-t8 bg-page/85 p-3 backdrop-blur-sm"
      >
        <Button
          v-if="settled && !session"
          as="a"
          :href="signInHref"
          size="lg"
          class="w-full"
          data-testid="workflow-run-signin"
          @click="leaveForSignIn($event, signInHref)"
        >
          {{ t('workshop.run.signIn', locale) }}
        </Button>

        <Button
          v-else
          size="lg"
          class="w-full"
          :disabled="busy || !settled"
          data-testid="workflow-run-button"
          @click="run"
        >
          {{ t('workshop.v2.run.run', locale) }}
        </Button>

        <Button
          v-if="state.phase === 'tracking'"
          variant="outline"
          size="sm"
          class="w-full"
          data-testid="workflow-run-cancel"
          @click="cancel"
        >
          {{ t('workshop.v2.run.cancel', locale) }}
        </Button>
      </div>
    </div>

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
          v-if="state.phase === 'error'"
          class="border-danger/40 flex flex-col gap-3 rounded-xl border p-4"
          data-testid="workflow-run-error"
        >
          <p class="text-sm text-content">{{ state.message }}</p>
          <Button
            v-if="state.jobId"
            variant="outline"
            size="sm"
            data-testid="workflow-run-resume"
            @click="resume"
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
          v-else-if="sample && state.phase === 'idle'"
          :src="sample"
          :alt="t('workshop.output.title', locale)"
          loading="lazy"
          decoding="async"
          class="aspect-video w-full rounded-xl bg-hub-surface object-cover"
          data-testid="workflow-run-sample"
        />
      </div>
    </div>
  </section>
</template>
