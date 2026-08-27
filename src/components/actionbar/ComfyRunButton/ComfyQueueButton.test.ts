import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  JobListItem,
  JobStatus
} from '@/platform/remote/comfyui/jobs/jobTypes'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import ComfyQueueButton from './ComfyQueueButton.vue'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => null
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    shiftDown: false
  })
}))

const BatchCountEditStub = {
  template: '<div data-testid="batch-count-edit" />'
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      menu: {
        run: 'Run',
        runOptions: 'Run options',
        disabledTooltip: 'Disabled tooltip',
        onChange: 'On Change',
        onChangeTooltip: 'On change tooltip',
        instant: 'Instant',
        instantTooltip: 'Instant tooltip',
        stopRunInstant: 'Stop Run (Instant)',
        stopRunInstantTooltip: 'Stop running',
        runWorkflow: 'Run workflow',
        runWorkflowFront: 'Run workflow front',
        runWorkflowMissingResources: 'Workflow contains missing resources'
      },
      subscription: {
        paymentRecovery: {
          ownerRunLabel: 'Update payment to run',
          memberRunLabel: 'Run',
          ownerRunTooltip: 'Update payment to restore this subscription',
          memberRunTooltip:
            'Ask your workspace owner to restore this subscription'
        }
      }
    }
  }
})

function createTask(id: string, status: JobStatus): TaskItemImpl {
  const job: JobListItem = {
    id,
    status,
    create_time: Date.now(),
    priority: 1
  }

  return new TaskItemImpl(job)
}

function getQueueButtonIcon() {
  return screen.getByTestId('queue-button-icon')
}

const missingModelCandidate: MissingModelCandidate = {
  nodeId: '1',
  nodeType: 'CheckpointLoaderSimple',
  widgetName: 'ckpt_name',
  isAssetSupported: false,
  name: 'missing.safetensors',
  isMissing: true
}

const missingMediaCandidate: MissingMediaCandidate = {
  nodeId: '2',
  nodeType: 'LoadImage',
  widgetName: 'image',
  mediaType: 'image',
  name: 'missing.png',
  isMissing: true
}

const missingResourceCases = [
  {
    label: 'nodes',
    setMissing: () => {
      useMissingNodesErrorStore().missingNodesError = {
        message: 'Missing nodes',
        nodeTypes: ['MissingNode']
      }
    },
    clearMissing: () => {
      useMissingNodesErrorStore().missingNodesError = null
    }
  },
  {
    label: 'models',
    setMissing: () => {
      useMissingModelStore().missingModelCandidates = [missingModelCandidate]
    },
    clearMissing: () => {
      useMissingModelStore().missingModelCandidates = null
    }
  },
  {
    label: 'media',
    setMissing: () => {
      useMissingMediaStore().missingMediaCandidates = [missingMediaCandidate]
    },
    clearMissing: () => {
      useMissingMediaStore().missingMediaCandidates = null
    }
  }
]

const stubs = {
  BatchCountEdit: BatchCountEditStub,
  DropdownMenuRoot: { template: '<div><slot /></div>' },
  DropdownMenuTrigger: { template: '<div><slot /></div>' },
  DropdownMenuPortal: { template: '<div><slot /></div>' },
  DropdownMenuContent: { template: '<div><slot /></div>' },
  DropdownMenuItem: { template: '<div><slot /></div>' }
}

function renderQueueButton(
  props: { paymentRecoveryLock?: 'owner' | 'member' } = {}
) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: (actionName) => actionName !== 'recordPromptError'
  })
  const user = userEvent.setup()

  const result = render(ComfyQueueButton, {
    props,
    global: {
      plugins: [PrimeVue, pinia, i18n],
      directives: {
        tooltip: Tooltip
      },
      stubs
    }
  })

  return { ...result, user }
}

describe('ComfyQueueButton', () => {
  it('renders the batch count control before the run button', () => {
    renderQueueButton()
    const controls = screen.getAllByTestId(/batch-count-edit|queue-button/)

    expect(controls[0]).toHaveAttribute('data-testid', 'batch-count-edit')
    expect(controls[1]).toHaveAttribute('data-testid', 'queue-button')
  })

  it.for([
    {
      paymentRecoveryLock: 'owner',
      label: 'Update payment to run',
      variant: 'subscribe'
    },
    { paymentRecoveryLock: 'member', label: 'Run', variant: 'secondary' }
  ] as const)(
    'keeps the queue group mounted for a paused $paymentRecoveryLock and blocks execution',
    async ({ paymentRecoveryLock, label, variant }) => {
      useQueueSettingsStore().mode = 'change'
      const { user, emitted } = renderQueueButton({ paymentRecoveryLock })
      const commandStore = useCommandStore()

      expect(screen.getByTestId('batch-count-edit')).toBeInTheDocument()
      expect(screen.getByTestId('queue-mode-menu-trigger')).toBeDisabled()
      expect(useQueueSettingsStore().mode).toBe('disabled')
      const button = screen.getByTestId('queue-button')
      expect(button).toHaveTextContent(label)
      expect(button).toHaveAttribute('data-variant', variant)

      await user.click(button)

      expect(commandStore.execute).not.toHaveBeenCalled()
      expect(emitted()).toHaveProperty('paymentRecoveryClick')
    }
  )

  it.for(missingResourceCases)(
    'clears the warning icon when missing $label are resolved',
    async ({ setMissing, clearMissing }) => {
      renderQueueButton()

      setMissing()
      await nextTick()

      expect(getQueueButtonIcon()).toHaveClass('icon-[lucide--triangle-alert]')

      clearMissing()
      await nextTick()

      expect(getQueueButtonIcon()).toHaveClass('icon-[lucide--play]')
    }
  )

  it('keeps Run enabled with the missing-resource warning and tooltip', async () => {
    const { user } = renderQueueButton()
    useMissingModelStore().missingModelCandidates = [missingModelCandidate]
    await nextTick()

    const queueButton = screen.getByTestId('queue-button')
    expect(queueButton).toBeEnabled()

    await user.hover(queueButton)

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Workflow contains missing resources'
    )
  })

  it('keeps the play icon for non-missing errors', async () => {
    renderQueueButton()
    useExecutionErrorStore().recordPromptError({
      type: 'execution',
      message: 'Failed to queue',
      details: ''
    })
    await nextTick()

    expect(getQueueButtonIcon()).toHaveClass('icon-[lucide--play]')
  })

  it('keeps the run instant presentation while idle even with active jobs', async () => {
    renderQueueButton()
    const queueSettingsStore = useQueueSettingsStore()
    const queueStore = useQueueStore()

    queueSettingsStore.mode = 'instant-idle'
    queueStore.runningTasks = [createTask('run-1', 'in_progress')]
    await nextTick()

    const queueButton = screen.getByTestId('queue-button')

    expect(queueButton).toHaveTextContent('Run (Instant)')
    expect(queueButton).toHaveAttribute('data-variant', 'primary')
  })

  it('switches to stop presentation when instant mode is armed', async () => {
    renderQueueButton()
    const queueSettingsStore = useQueueSettingsStore()

    queueSettingsStore.mode = 'instant-running'
    await nextTick()

    const queueButton = screen.getByTestId('queue-button')

    expect(queueButton).toHaveTextContent('Stop Run (Instant)')
    expect(queueButton).toHaveAttribute('data-variant', 'destructive')
  })

  it('disarms instant mode without interrupting even when jobs are active', async () => {
    const { user } = renderQueueButton()
    const queueSettingsStore = useQueueSettingsStore()
    const queueStore = useQueueStore()
    const commandStore = useCommandStore()

    queueSettingsStore.mode = 'instant-running'
    queueStore.runningTasks = [createTask('run-1', 'in_progress')]
    await nextTick()

    await user.click(screen.getByTestId('queue-button'))
    await nextTick()

    expect(queueSettingsStore.mode).toBe('instant-idle')
    const queueButton = screen.getByTestId('queue-button')
    expect(queueButton).toHaveTextContent('Run (Instant)')
    expect(queueButton).toHaveAttribute('data-variant', 'primary')

    expect(commandStore.execute).not.toHaveBeenCalled()
  })

  it('activates instant running mode when queueing again', async () => {
    const { user } = renderQueueButton()
    const queueSettingsStore = useQueueSettingsStore()
    const commandStore = useCommandStore()

    queueSettingsStore.mode = 'instant-idle'
    await nextTick()

    await user.click(screen.getByTestId('queue-button'))
    await nextTick()

    expect(queueSettingsStore.mode).toBe('instant-running')
    expect(commandStore.execute).toHaveBeenCalledWith('Comfy.QueuePrompt', {
      metadata: {
        subscribe_to_run: false,
        trigger_source: 'button'
      }
    })
  })
})
