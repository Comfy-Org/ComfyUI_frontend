import type { Meta, StoryObj } from '@storybook/vue3-vite'

import QueueInlineProgressSummary from './QueueInlineProgressSummary.vue'
import { useExecutionStore } from '@/stores/executionStore'

type SeedOptions = {
  promptId: string
  nodes: Record<string, boolean>
  runningNodeId?: string
  runningNodeTitle?: string
  runningNodeType?: string
  currentValue?: number
  currentMax?: number
}

function resetExecutionStore() {
  const exec = useExecutionStore()
  exec.activePromptId = null
  exec.queuedPrompts = {}
  exec.nodeProgressStates = {}
  exec.nodeProgressStatesByPrompt = {}
  exec._executingNodeProgress = null
  exec.lastExecutionError = null
  exec.lastNodeErrors = null
  exec.initializingPromptIds = new Set()
  exec.promptIdToWorkflowId = new Map()
}

function seedExecutionState({
  promptId,
  nodes,
  runningNodeId,
  runningNodeTitle,
  runningNodeType,
  currentValue = 0,
  currentMax = 100
}: SeedOptions) {
  resetExecutionStore()

  const exec = useExecutionStore()
  const workflow = runningNodeId
    ? ({
        changeTracker: {
          activeState: {
            nodes: Object.keys(nodes).map((id) => ({
              id,
              title:
                id === runningNodeId ? (runningNodeTitle ?? '') : `Node ${id}`,
              type: id === runningNodeId ? (runningNodeType ?? 'Node') : 'Node'
            }))
          }
        }
      } as any)
    : undefined

  exec.activePromptId = promptId
  exec.queuedPrompts = {
    [promptId]: {
      nodes,
      ...(workflow ? { workflow } : {})
    }
  } as any

  const nodeProgress = runningNodeId
    ? {
        [runningNodeId]: {
          value: currentValue,
          max: currentMax,
          state: 'running',
          node_id: runningNodeId,
          prompt_id: promptId
        }
      }
    : {}

  exec.nodeProgressStates = nodeProgress as any
  exec.nodeProgressStatesByPrompt = runningNodeId
    ? ({ [promptId]: nodeProgress } as any)
    : {}
  exec._executingNodeProgress = runningNodeId
    ? ({
        value: currentValue,
        max: currentMax,
        prompt_id: promptId,
        node: runningNodeId
      } as any)
    : null
}

const meta: Meta<typeof QueueInlineProgressSummary> = {
  title: 'Queue/QueueInlineProgressSummary',
  component: QueueInlineProgressSummary,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'light'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const RunningKSampler: Story = {
  render: () => ({
    components: { QueueInlineProgressSummary },
    setup() {
      seedExecutionState({
        promptId: 'prompt-running',
        nodes: { '1': true, '2': false, '3': false, '4': true },
        runningNodeId: '2',
        runningNodeTitle: 'KSampler',
        runningNodeType: 'KSampler',
        currentValue: 12,
        currentMax: 100
      })

      return {}
    },
    template: `
      <div style="background: var(--color-surface-primary); width: 420px; padding: 12px;">
        <QueueInlineProgressSummary />
      </div>
    `
  })
}

export const RunningWithFallbackName: Story = {
  render: () => ({
    components: { QueueInlineProgressSummary },
    setup() {
      seedExecutionState({
        promptId: 'prompt-fallback',
        nodes: { '10': true, '11': true, '12': false, '13': true },
        runningNodeId: '12',
        runningNodeTitle: '',
        runningNodeType: 'custom_node',
        currentValue: 78,
        currentMax: 100
      })

      return {}
    },
    template: `
      <div style="background: var(--color-surface-primary); width: 420px; padding: 12px;">
        <QueueInlineProgressSummary />
      </div>
    `
  })
}

export const ProgressWithoutCurrentNode: Story = {
  render: () => ({
    components: { QueueInlineProgressSummary },
    setup() {
      seedExecutionState({
        promptId: 'prompt-progress-only',
        nodes: { '21': true, '22': true, '23': true, '24': false }
      })

      return {}
    },
    template: `
      <div style="background: var(--color-surface-primary); width: 420px; padding: 12px;">
        <QueueInlineProgressSummary />
      </div>
    `
  })
}
