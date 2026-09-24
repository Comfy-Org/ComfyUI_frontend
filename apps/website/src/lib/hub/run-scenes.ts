import { zJobDetailResponse } from '@comfyorg/ingest-types/zod'

import type { RunState } from '../../composables/useWorkflowRun'
import { templateAsset } from '../../config/workflow-fields'

// Every state the output panel can be in, as data rather than as a page. A run
// costs credits and most of these cannot be reached on purpose at all, so the
// only way to look at one is to hand the panel the state. The reference sheet
// and the switch on a workflow page read the same list, so neither can drift.

const STILL = templateAsset('templates', 'flux_fill_inpaint_example-1.webp')
const MADE = templateAsset('templates', 'flux_fill_inpaint_example-2.webp')

type JobStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'

const JOB_ID = '11111111-2222-3333-4444-555555555555'

// A wait that has been going a little while, so the count beside the spinner
// reads as a real one rather than a stopped clock.
const STARTED = Date.now() - 74_000

const job = (status: JobStatus) =>
  zJobDetailResponse.parse({
    id: JOB_ID,
    status,
    create_time: 0n,
    update_time: 0n
  })

export interface RunScene {
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

export const RUN_SCENES: readonly RunScene[] = [
  {
    name: 'Before the first run',
    when: 'The page has just opened. Nothing has been made yet, so the panel shows what this workflow makes.',
    state: { phase: 'idle' },
    sample: STILL
  },
  {
    name: 'Uploading',
    when: 'The reader pressed Run and their files are going up. Nothing has reached Cloud yet.',
    state: { phase: 'uploading', startedAt: STARTED }
  },
  {
    name: 'Sending',
    when: 'The files are up and the whole graph is on its way to Cloud.',
    state: { phase: 'submitting', startedAt: STARTED }
  },
  {
    name: 'Queued',
    when: 'Cloud has the job and has not started it.',
    state: { phase: 'tracking', job: job('pending'), startedAt: STARTED }
  },
  {
    name: 'Generating',
    when: 'The job is running.',
    state: { phase: 'tracking', job: job('in_progress'), startedAt: STARTED }
  },
  {
    name: 'Queued, on its own server',
    when: 'The one workflow that wakes a server of its own. It waits on that rather than in a queue, so a slow first run reads as the shape of the thing.',
    state: { phase: 'tracking', job: job('pending'), startedAt: STARTED },
    coldStart: true
  },
  {
    name: 'Generating, on its own server',
    when: 'The same run, once the server is awake.',
    state: { phase: 'tracking', job: job('in_progress'), startedAt: STARTED },
    coldStart: true
  },
  {
    name: 'Reconnecting',
    when: 'The page lost the job and is asking Cloud where it got to. The run itself never stopped.',
    state: { phase: 'reconnecting', startedAt: STARTED }
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
