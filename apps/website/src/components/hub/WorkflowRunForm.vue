<script setup lang="ts">
import { computed } from 'vue'

import { usePersonalWorkspace } from '../../composables/usePersonalWorkspace'
import { useSignInHref } from '../../composables/useSignInHref'
import { useWorkflowRun } from '../../composables/useWorkflowRun'
import type { WorkflowGraph } from '../../config/workflow-execution'
import type { WorkflowField } from '../../config/workflow-fields'
import type { RunWayOut } from '../../lib/hub/run-failure'
import { previewScene } from '../../lib/hub/run-preview'
import { runUnderWay } from '../../lib/hub/run-progress'
import { requestWorkshopBuyCredits } from '../../config/workshop-buy-credits'
import { useWorkshopCredits } from '../../config/workshop-credits'
import { leaveForSignIn } from '../../config/workshop-return'
import type { Locale } from '../../i18n/translations'
import { tHub } from '../../i18n/hub'
import Button from '../ui/button/Button.vue'
import WorkflowRunCamera from './WorkflowRunCamera.vue'
import WorkflowRunField from './WorkflowRunField.vue'
import WorkflowRunGate from './WorkflowRunGate.vue'
import WorkflowRunResult from './WorkflowRunResult.vue'

// The workflow, run where it actually runs. Cloud takes the whole graph in the
// request, so the page fills in the answers the bindings name and sends it;
// there is no per-workflow endpoint to wait for.
const {
  fields,
  graph,
  slug = '',
  sample,
  coldStart = false,
  locale = 'en'
} = defineProps<{
  fields: readonly WorkflowField[]
  graph: WorkflowGraph
  /** This workflow's name, under which its last result is remembered. */
  slug?: string
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
  sending,
  busy,
  session,
  settled,
  run,
  resume,
  cancel
} = useWorkflowRun(fields, graph, slug)

const { balance } = useWorkshopCredits()
const {
  switching,
  failed: switchFailed,
  switchToPersonal
} = usePersonalWorkspace()

const signInHref = useSignInHref(locale)

const address = (field: WorkflowField) => `${field.node}.${field.input}`

/**
 * Where the camera stands, when this workflow asks for all three readings of
 * it. Three boxes of degrees are one question badly asked, so they leave the
 * list of fields and become the camera itself.
 */
const POSE_AXES = ['azimuth', 'elevation', 'zoom'] as const

const posed = computed(() => {
  const found = new Map(
    fields.filter((field) => field.pose).map((field) => [field.pose, field])
  )
  return POSE_AXES.every((axis) => found.has(axis)) ? found : undefined
})

/** One axis of the pose, read and written where the answer already lives. */
const axis = (name: (typeof POSE_AXES)[number]) =>
  computed({
    get: () =>
      Number(values.value[address(posed.value?.get(name) ?? fields[0])]),
    set: (degrees: number) => {
      const field = posed.value?.get(name)
      if (field) values.value[address(field)] = degrees
    }
  })

const camera = {
  azimuth: axis('azimuth'),
  elevation: axis('elevation'),
  zoom: axis('zoom')
}

/** The picture the pose is being chosen for, once the reader has one. */
const subject = computed(() => {
  const carrying = fields.find((field) => files.value[address(field)])
  return carrying ? files.value[address(carrying)]?.previewUrl : undefined
})

// The rest of the form keeps its place in the run, because the panel names
// answers by where they stand in it while they go up.
const asked = computed(() =>
  fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => !posed.value || !field.pose)
)

/** What the reference tool has stood the panel up in, where it was asked for. */
const scene = previewScene

const shown = computed(() => scene.value?.state ?? state.value)
const shownOutputs = computed(() => scene.value?.outputs ?? outputs.value)

// A scene is a picture of a run rather than one being paid for, so while it
// stands the form follows it: nobody has to sign in or hold credits to look
// at the state the panel is in.
const signedOut = computed(
  () => !scene.value && settled.value && !session.value
)

const underWay = computed(() =>
  scene.value ? runUnderWay(shown.value.phase) : busy.value
)

const running = computed(() => shown.value.phase === 'tracking')

// The panel says files are going up; the scene that shows that says which one.
const goingUp = computed(() =>
  scene.value ? (shown.value.phase === 'uploading' ? 0 : -1) : sending.value
)

/**
 * The workspace this run would spend, named only where the reader is a member
 * rather than its owner. Buying is then the owner's to do, so the panel and
 * the button both have to say whose wallet is empty.
 */
const memberWorkspace = computed(() =>
  session.value?.role === 'member' ? session.value.workspace.name : undefined
)

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

/**
 * Asking before the run rather than after it. A reader with nothing to spend
 * would otherwise upload their files, wait, and be told at the end.
 */
const broke = computed(
  () =>
    !scene.value &&
    !!session.value &&
    !busy.value &&
    balance.value.status === 'ok' &&
    balance.value.credits <= 0
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
        {{ tHub('workshop.input.title', locale) }}
      </header>

      <div class="flex flex-col gap-8 p-5" data-testid="workflow-run-inputs">
        <WorkflowRunCamera
          v-if="posed"
          v-model:azimuth="camera.azimuth.value"
          v-model:elevation="camera.elevation.value"
          v-model:zoom="camera.zoom.value"
          :subject
          :locale
        />

        <WorkflowRunField
          v-for="{ field, index } in asked"
          :key="address(field)"
          v-model="values[address(field)]"
          v-model:file="files[address(field)]"
          :field
          :name="address(field)"
          :disabled="underWay"
          :sending="index === goingUp"
          :sent="goingUp >= 0 && index < goingUp"
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
          :disabled="underWay || !settled"
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
