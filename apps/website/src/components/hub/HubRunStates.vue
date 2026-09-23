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

const job = (status: JobStatus) =>
  zJobDetailResponse.parse({
    id: '11111111-2222-3333-4444-555555555555',
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
    name: 'Failed before anything left the page',
    when: 'Nothing was spent, so pressing Run again is safe and the panel says nothing else.',
    state: {
      phase: 'error',
      message: 'The image is larger than 100 MB.',
      retrySafe: true
    }
  },
  {
    name: 'Failed with a run still out there',
    when: 'A job exists. Running again would spend a second one, so the panel offers to go and find the first.',
    state: {
      phase: 'error',
      message:
        'Could not reach Cloud. Check your Cloud job history before submitting again.',
      jobId: '11111111-2222-3333-4444-555555555555',
      retrySafe: false
    }
  }
]

const missing = [
  'Not enough credits, with the way to buy more — and the different wording for someone inside another person’s workspace.',
  'The named reasons a run is refused: blocked by policy, too many at once, rate limited, unavailable, timed out, file unreadable.',
  'Cancelled, as an outcome rather than only a button.'
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
        A model's playground tells these apart; a workflow's shows them all as
        the one message above.
      </p>
      <ul
        class="flex list-disc flex-col gap-2 ps-5 text-sm/relaxed text-primary-warm-gray"
      >
        <li v-for="gap in missing" :key="gap">{{ gap }}</li>
      </ul>
      <p class="text-sm/relaxed text-primary-warm-gray">
        The input panel's own two states — Sign in when nobody is signed in, and
        Cancel while a run is going — sit beside the form on a real workflow
        page rather than here.
      </p>
    </section>
  </div>
</template>
