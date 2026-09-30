import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { RunFailure, RunState } from '../../config/workshop-run'
import { t } from '../../i18n/translations'
import PlaygroundOutput from './PlaygroundOutput.vue'

// A run costs credits and most of these states cannot be reached on purpose at
// all, so the only way to look at one is to hand the panel the state. Reviewing
// the words and the shape of a refusal should not need a wallet, a failing
// provider, or a lost connection.

const IMAGE =
  'https://media.comfy.org/website/workshop/beeble/switchx-image-edit/studio-to-neon-alley.png'
const VIDEO =
  'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@main/output/api_bfl_flux3_t2v.mp4'

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0)
/** A wait that has been going a little while, so the count reads as a real one. */
const STARTED = NOW - 74_000

const image = { kind: 'image' as const, url: IMAGE, fileName: 'result.png' }
const video = { kind: 'video' as const, url: VIDEO, fileName: 'result.mp4' }

const meta: Meta<typeof PlaygroundOutput> = {
  title: 'Website/Workshop/PlaygroundOutput',
  component: PlaygroundOutput,
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-comfy-ink p-8"><div class="max-w-2xl"><story /></div></div>'
    })
  ],
  args: {
    now: NOW,
    modelName: 'SwitchX Image Edit',
    state: { status: 'idle' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Idle: Story = {}

/** What the model makes, until a run of the reader's own replaces it. */
export const Example: Story = {
  args: { state: { status: 'example', output: image } }
}

export const Succeeded: Story = {
  args: {
    state: {
      status: 'succeeded',
      output: image,
      nsfw: false,
      completedAt: NOW - 2_000
    }
  }
}

/** A video is not a larger image: it arrives with its own controls. */
export const SucceededVideo: Story = {
  args: {
    modality: 'video',
    state: {
      status: 'succeeded',
      output: video,
      nsfw: false,
      completedAt: NOW - 2_000
    }
  }
}

export const SucceededSensitive: Story = {
  args: {
    state: {
      status: 'succeeded',
      output: image,
      nsfw: true,
      completedAt: NOW - 2_000
    }
  }
}

export const Expired: Story = {
  args: {
    state: {
      status: 'succeeded',
      output: image,
      nsfw: false,
      completedAt: NOW - 90_000_000,
      expiresAt: NOW - 1_000
    }
  }
}

/** The same status, said the way each half of the Hub means it. */
export const Cancelled: Story = {
  args: { state: { status: 'cancelled' } }
}

export const CancelledWorkflow: Story = {
  args: {
    state: { status: 'cancelled' },
    cancelledMessage: t('workshop.workflow.cancelled')
  }
}

// Every wait the two pages name, in the order a reader meets them. The panel
// takes the wait as a sentence, so these are the real ones rather than
// look-alikes that could drift from the copy.
const WAITS = [
  'workshop.workflow.preparing',
  'workshop.workflow.submitting',
  'workshop.workflow.queued',
  'workshop.run.running',
  'workshop.workflow.delivering',
  'workshop.workflow.cancelling',
  'workshop.workflow.interrupted'
] as const

export const EveryWait: Story = {
  render: (args) => ({
    components: { PlaygroundOutput },
    setup: () => ({
      args,
      waits: WAITS.map((key) => ({ key, label: t(key) }))
    }),
    template: `
      <div class="flex flex-col gap-6">
        <div v-for="wait in waits" :key="wait.key" class="flex flex-col gap-2">
          <p class="text-2xs font-bold tracking-wider text-primary-warm-gray uppercase">{{ wait.key }}</p>
          <PlaygroundOutput
            v-bind="args"
            :state="{ status: 'running', startedAt: ${STARTED}, label: wait.label }"
          />
        </div>
      </div>
    `
  })
}

// Every refusal the panel has words for. The scenes after the list are the same
// reasons said differently because of who the reader is or what they sent;
// `validation` is only ever one of those, so it is not in the list itself.
const REFUSALS: readonly RunFailure[] = [
  'provider',
  'upload',
  'network',
  'response',
  'client',
  'concurrency',
  'conflict',
  'rateLimit',
  'policy',
  'noCredits',
  'unavailable',
  'timeout'
]

interface RefusalScene {
  readonly name: string
  readonly state: RunState
  readonly memberWorkspace?: string
}

const refusal = (reason: RunFailure): RunState => ({
  status: 'failed',
  reason,
  fieldErrors: {}
})

const REFUSAL_SCENES: readonly RefusalScene[] = [
  ...REFUSALS.map((reason) => ({ name: reason, state: refusal(reason) })),
  {
    name: 'noCredits, in a workspace the reader is a member of',
    state: refusal('noCredits'),
    memberWorkspace: 'Comfy Design'
  },
  {
    name: 'validation, pinned to a field',
    state: {
      status: 'failed',
      reason: 'validation',
      fieldErrors: { prompt: 'required' }
    }
  },
  {
    name: 'validation, with nothing to pin it to',
    state: refusal('validation')
  },
  {
    name: 'a file the page could not read',
    state: {
      status: 'failed',
      reason: 'validation',
      fieldErrors: { image: 'fileUnreadable' }
    }
  }
]

export const EveryRefusal: Story = {
  render: (args) => ({
    components: { PlaygroundOutput },
    setup: () => ({ args, scenes: REFUSAL_SCENES }),
    template: `
      <div class="flex flex-col gap-6">
        <div v-for="scene in scenes" :key="scene.name" class="flex flex-col gap-2">
          <p class="text-2xs font-bold tracking-wider text-primary-warm-gray uppercase">{{ scene.name }}</p>
          <PlaygroundOutput
            v-bind="args"
            :state="scene.state"
            :member-workspace="scene.memberWorkspace"
          />
        </div>
      </div>
    `
  })
}
