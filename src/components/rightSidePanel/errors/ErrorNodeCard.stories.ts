import type { Meta, StoryObj } from '@storybook/vue3-vite'
import ErrorNodeCard from './ErrorNodeCard.vue'
import type { ErrorCardData } from './types'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

const meta: Meta<typeof ErrorNodeCard> = {
  title: 'RightSidePanel/Errors/ErrorNodeCard',
  component: ErrorNodeCard,
  parameters: {
    layout: 'centered'
  },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="w-[330px] bg-base-surface border border-interface-stroke rounded-lg p-4"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

const singleErrorCard: ErrorCardData = {
  id: 'node-10',
  title: 'CLIPTextEncode',
  nodeId: createNodeExecutionId([toNodeId(10)]),
  nodeTitle: 'CLIP Text Encode (Prompt)',
  errors: [
    {
      message: 'Required input "text" is missing.',
      details: 'Input: text\nExpected: STRING'
    }
  ]
}

const multipleErrorsCard: ErrorCardData = {
  id: 'node-24',
  title: 'VAEDecode',
  nodeId: createNodeExecutionId([toNodeId(24)]),
  nodeTitle: 'VAE Decode',
  errors: [
    {
      message: 'Required input "samples" is missing.',
      details: ''
    },
    {
      message: 'Value "NaN" is not a valid number for "strength".',
      details: 'Expected: FLOAT [0.0 .. 1.0]'
    }
  ]
}

const runtimeErrorCard: ErrorCardData = {
  id: 'exec-45',
  title: 'KSampler',
  nodeId: createNodeExecutionId([toNodeId(45)]),
  nodeTitle: 'KSampler',
  errors: [
    {
      message: 'OutOfMemoryError: CUDA out of memory. Tried to allocate 1.2GB.',
      details: [
        'Traceback (most recent call last):',
        '  File "ksampler.py", line 142, in sample',
        '    samples = model.apply(latent)',
        'RuntimeError: CUDA out of memory.'
      ].join('\n'),
      isRuntimeError: true
    }
  ]
}

const subgraphErrorCard: ErrorCardData = {
  id: 'node-3:15',
  title: 'KSampler',
  nodeId: createNodeExecutionId([toNodeId(3), toNodeId(15)]),
  nodeTitle: 'Nested KSampler',
  errors: [
    {
      message: 'Latent input is required.',
      details: ''
    }
  ]
}

const promptOnlyCard: ErrorCardData = {
  id: '__prompt__',
  title: 'Prompt has no outputs.',
  errors: [
    {
      message:
        'The workflow does not contain any output nodes (e.g. Save Image, Preview Image) to produce a result.'
    }
  ]
}

export const SingleValidationError: Story = {
  args: {
    card: singleErrorCard
  }
}

export const NestedNodeError: Story = {
  args: {
    card: subgraphErrorCard
  }
}

/** Multiple validation errors on one node */
export const MultipleErrors: Story = {
  args: {
    card: multipleErrorsCard
  }
}

/** Runtime execution error with full traceback */
export const RuntimeError: Story = {
  args: {
    card: runtimeErrorCard
  }
}

/** Prompt-level error (no node header) */
export const PromptError: Story = {
  args: {
    card: promptOnlyCard
  }
}
