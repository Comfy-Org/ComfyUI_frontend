<script setup lang="ts">
import { computed } from 'vue'

import { usePersonalWorkspace } from '../../composables/usePersonalWorkspace'
import { useSignInHref } from '../../composables/useSignInHref'
import { useWorkflowRun } from '../../composables/useWorkflowRun'
import type { WorkflowGraph } from '../../config/workflow-execution'
import type { WorkflowField } from '../../config/workflow-fields'
import type { RunWayOut } from '../../lib/hub/run-failure'
import { previewScene } from '../../lib/hub/run-preview'
import { requestWorkshopBuyCredits } from '../../config/workshop-buy-credits'
import { useWorkshopCredits } from '../../config/workshop-credits'
import { leaveForSignIn } from '../../config/workshop-return'
import type { Locale } from '../../i18n/translations'
import { tHub } from '../../i18n/hub'
import Button from '../ui/button/Button.vue'
import WorkflowRunField from './WorkflowRunField.vue'
import WorkflowRunGate from './WorkflowRunGate.vue'
import WorkflowRunResult from './WorkflowRunResult.vue'

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

const { balance } = useWorkshopCredits()
const {
  switching,
  failed: switchFailed,
  switchToPersonal
} = usePersonalWorkspace()

const signInHref = useSignInHref(locale)

const address = (field: WorkflowField) => `${field.node}.${field.input}`

const signedOut = computed(() => settled.value && !session.value)

const running = computed(() => state.value.phase === 'tracking')

/**
 * The workspace this run would spend, named only where the reader is a member
 * rather than its owner. Buying is then the owner's to do, so the panel and
 * the button both have to say whose wallet is empty.
 */
const memberWorkspace = computed(() =>
  session.value?.role === 'member' ? session.value.workspace.name : undefined
)

/**
 * Asking before the run rather than after it. A reader with nothing to spend
 * would otherwise upload their files, wait, and be told at the end.
 */
/**
 * The ways out the panel can offer, each wired to the thing that takes it.
 * Trying again is simply running it again, with the same answers in place.
 */
const ways: Record<RunWayOut, () => void> = {
  resume: () => void resume(),
  retry: () => void run(),
  credits: requestWorkshopBuyCredits,
  personal: () => void switchToPersonal()
}

const broke = computed(
  () =>
    !!session.value &&
    !busy.value &&
    balance.value.status === 'ok' &&
    balance.value.credits <= 0
)

/** What the reference tool has stood the panel up in, where it was asked for. */
const scene = previewScene

const shown = computed(() => scene.value?.state ?? state.value)
const shownOutputs = computed(() => scene.value?.outputs ?? outputs.value)
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
        {{ tHub('workshop.input.title', locale) }}
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
        class="mt-auto flex flex-col gap-2 rounded-b-2xl border-t border-transparency-white-t8 p-3"
      >
        <Button
          v-if="signedOut"
          as="a"
          :href="signInHref"
          size="lg"
          class="w-full"
          data-testid="workflow-run-signin"
          @click="leaveForSignIn($event, signInHref)"
        >
          {{ tHub('workshop.run.signIn', locale) }}
        </Button>

        <WorkflowRunGate
          v-else-if="broke && session"
          :workspace="session.workspace.name"
          :member="memberWorkspace !== undefined"
          :switching
          :switch-failed="switchFailed"
          :locale
          @personal="switchToPersonal"
        />

        <Button
          v-else
          size="lg"
          class="w-full"
          :disabled="busy || !settled"
          data-testid="workflow-run-button"
          @click="run"
        >
          {{ tHub('workshop.v2.run.run', locale) }}
        </Button>

        <Button
          v-if="running"
          variant="outline"
          size="sm"
          class="w-full"
          data-testid="workflow-run-cancel"
          @click="cancel"
        >
          {{ tHub('workshop.v2.run.cancel', locale) }}
        </Button>
      </div>
    </div>

    <WorkflowRunResult
      :state="shown"
      :outputs="shownOutputs"
      :sample="scene ? scene.sample : sample"
      :cold-start="scene?.coldStart ?? coldStart"
      :member-workspace="scene ? scene.memberWorkspace : memberWorkspace"
      :locale
      @press="ways[$event]()"
    />
  </section>
</template>
