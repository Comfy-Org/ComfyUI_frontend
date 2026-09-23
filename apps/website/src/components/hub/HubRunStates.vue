<script setup lang="ts">
import { zJobDetailResponse } from '@comfyorg/ingest-types/zod'

import type { RunState } from '../../composables/useWorkflowRun'
import { templateAsset } from '../../config/workflow-fields'
import type { Locale } from '../../i18n/translations'
import WorkflowRunResult from './WorkflowRunResult.vue'

// Every state the output panel can be in, drawn side by side against nothing.
// A run costs credits and most of these states cannot be reached on purpose
// at all, so the only way to look at them together is to hand the panel the
// state rather than wait for it.
const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const STILL = templateAsset('templates', 'flux_fill_inpaint_example-1.webp')
const MADE = templateAsset('templates', 'flux_fill_inpaint_example-2.webp')

type JobStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'

const JOB_ID = '11111111-2222-3333-4444-555555555555'

const job = (status: JobStatus) =>
  zJobDetailResponse.parse({
    id: JOB_ID,
    status,
    create_time: 0n,
    update_time: 0n
  })

interface Scene {
  readonly name: string
  /** When a reader meets it. */
  readonly when: string
  readonly state: RunState
  readonly outputs?: readonly { url: string; name: string; mime: string }[]
  readonly sample?: string
  readonly coldStart?: boolean
  /** Named where the reader is a member of that workspace, not its owner. */
  readonly memberWorkspace?: string
}

const scenes: readonly Scene[] = [
  {
    name: 'Before the first run',
    when: 'The page has just opened. Nothing has been made yet, so the panel shows what this workflow makes.',
    state: { phase: 'idle' },
    sample: STILL
  },
  {
    name: 'Uploading',
    when: 'The reader pressed Run and their files are going up. Nothing has reached Cloud yet.',
    state: { phase: 'uploading' }
  },
  {
    name: 'Sending',
    when: 'The files are up and the whole graph is on its way to Cloud.',
    state: { phase: 'submitting' }
  },
  {
    name: 'Queued',
    when: 'Cloud has the job and has not started it. The first step is where the run stands.',
    state: { phase: 'tracking', job: job('pending') }
  },
  {
    name: 'Generating',
    when: 'The job is running. The last step is where the run stands.',
    state: { phase: 'tracking', job: job('in_progress') }
  },
  {
    name: 'Queued, on its own server',
    when: 'The one workflow that wakes a server of its own. Its wait has three steps instead of two, so a slow first run reads as the shape of the thing.',
    state: { phase: 'tracking', job: job('pending') },
    coldStart: true
  },
  {
    name: 'Generating, on its own server',
    when: 'The same run, once the server is awake.',
    state: { phase: 'tracking', job: job('in_progress') },
    coldStart: true
  },
  {
    name: 'Reconnecting',
    when: 'The page lost the job and is asking Cloud where it got to. The run itself never stopped.',
    state: { phase: 'reconnecting' }
  },
  {
    name: 'Done',
    when: 'What came back. A video arrives with its own controls; an image arrives as an image.',
    state: { phase: 'finished', job: job('completed') },
    outputs: [{ url: MADE, name: 'Result', mime: 'image/webp' }]
  },
  {
    name: 'Cancelled',
    when: 'The reader stopped it themselves. Nothing went wrong, so it is not drawn as though something had.',
    state: { phase: 'cancelled' }
  },
  {
    name: 'Not enough credits',
    when: 'The wallet is empty and the reader owns it. On a real page this is asked before the run, on the Run button itself.',
    state: { phase: 'error', reason: 'noCredits', retrySafe: true }
  },
  {
    name: 'Not enough credits, in someone else’s workspace',
    when: 'The same emptiness, but buying is the owner’s to do. What is offered instead is the reader’s own workspace.',
    state: { phase: 'error', reason: 'noCredits', retrySafe: true },
    memberWorkspace: 'Comfy Design'
  },
  {
    name: 'Blocked by the workspace',
    when: 'Governance forbids one of the providers this workflow calls. Running again would be refused the same way, so nothing is offered.',
    state: { phase: 'error', reason: 'policy', retrySafe: true }
  },
  {
    name: 'The queue is full',
    when: 'This workspace has as many jobs queued as it may. Waiting for one to finish is what clears it.',
    state: { phase: 'error', reason: 'concurrency', retrySafe: true }
  },
  {
    name: 'Too many runs at once',
    when: 'Cloud is refusing the rate rather than the run. A moment and another press is the whole of it.',
    state: { phase: 'error', reason: 'rateLimit', retrySafe: true }
  },
  {
    name: 'Cloud cannot take it right now',
    when: 'Nothing about this workflow is wrong. Later it will run.',
    state: { phase: 'error', reason: 'unavailable', retrySafe: true }
  },
  {
    name: 'The run itself failed',
    when: 'Cloud accepted the graph, started it, and it came back failed. The run is over, so what is left is to run it again.',
    state: { phase: 'error', reason: 'provider', retrySafe: true }
  },
  {
    name: 'We stopped waiting',
    when: 'A run that finishes later is still billed, so the reader is told to retry the same request rather than start a new one.',
    state: { phase: 'error', reason: 'timeout', retrySafe: true }
  },
  {
    name: 'The session expired',
    when: 'The run never left the page. Signing in again is the only thing that helps.',
    state: { phase: 'error', reason: 'signedOut', retrySafe: true }
  },
  {
    name: 'A file could not go up',
    when: 'The upload failed before Cloud saw anything. Nothing was spent.',
    state: {
      phase: 'error',
      reason: 'upload',
      message:
        'The example input could not load. Upload your own file and try again.',
      retrySafe: true
    }
  },
  {
    name: 'The page could not finish the request',
    when: 'Something on this side gave way rather than Cloud refusing anything. Pressing again would go the same way, so nothing is offered.',
    state: { phase: 'error', reason: 'client', retrySafe: true }
  },
  {
    name: 'Stopped before anything left the page',
    when: 'The page refused the run itself, so it says what it wants rather than what Cloud would have said.',
    state: {
      phase: 'error',
      reason: 'validation',
      message: 'Choose an input smaller than 100 MB.',
      retrySafe: true
    }
  },
  {
    name: 'Lost, with a run still out there',
    when: 'A job exists. Running again would spend a second one, so the panel offers to go and find the first.',
    state: {
      phase: 'error',
      reason: 'network',
      jobId: JOB_ID,
      retrySafe: false
    }
  }
]

const missing = [
  'The named reasons a run is refused, told apart on a model page by the field that caused them: a file the page could read but the model would not.',
  'What a failed run actually said. Cloud returns the node and the exception; none of it is shown, because none of it is written for a reader.'
]
</script>

<template>
  <div class="flex flex-col gap-16">
    <header class="flex max-w-2xl flex-col gap-4">
      <p
        class="text-sm leading-none font-medium tracking-widest text-primary-comfy-yellow uppercase"
      >
        Reference
      </p>
      <h1 class="text-3xl font-bold text-primary-comfy-canvas lg:text-4xl">
        Every state a run passes through
      </h1>
      <p class="text-sm/relaxed text-primary-warm-gray">
        The real output panel, handed each state in turn. Nothing here runs,
        uploads or costs anything.
      </p>
    </header>

    <!-- The panel keeps the width it has on a workflow page, so what is read
      here is the thing itself rather than a wider copy of it. -->
    <section
      v-for="scene in scenes"
      :key="scene.name"
      class="grid gap-x-8 gap-y-4 lg:grid-cols-12"
      data-testid="run-state-scene"
    >
      <WorkflowRunResult
        :state="scene.state"
        :outputs="scene.outputs ?? []"
        :sample="scene.sample"
        :cold-start="scene.coldStart ?? false"
        :member-workspace="scene.memberWorkspace"
        :locale
      />
      <div class="flex flex-col gap-1 lg:col-span-5 lg:pt-3">
        <h2 class="text-lg font-bold text-primary-comfy-canvas">
          {{ scene.name }}
        </h2>
        <p class="text-sm/relaxed text-primary-warm-gray">{{ scene.when }}</p>
      </div>
    </section>

    <section class="flex max-w-2xl flex-col gap-3">
      <h2 class="text-lg font-bold text-primary-comfy-canvas">Not drawn yet</h2>
      <p class="text-sm/relaxed text-primary-warm-gray">
        Everything a run can be is above. What is left is detail a model's
        playground carries and this one does not.
      </p>
      <ul
        class="flex list-disc flex-col gap-2 ps-5 text-sm/relaxed text-primary-warm-gray"
      >
        <li v-for="gap in missing" :key="gap">{{ gap }}</li>
      </ul>
      <p class="text-sm/relaxed text-primary-warm-gray">
        The input panel's own states — Sign in when nobody is signed in, Cancel
        while a run is going, and the empty wallet asked about before the run
        rather than after it — sit beside the form on a real workflow page
        rather than here.
      </p>
    </section>
  </div>
</template>
