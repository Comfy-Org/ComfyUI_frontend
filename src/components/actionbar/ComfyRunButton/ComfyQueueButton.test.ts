import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  JobListItem,
  JobStatus
} from '@/platform/remote/comfyui/jobs/jobTypes'
import { useCommandStore } from '@/stores/commandStore'
import {
  TaskItemImpl,
  useQueueSettingsStore,
  useQueueStore
} from '@/stores/queueStore'
import { render, screen } from '@/utils/test-utils'

import ComfyQueueButton from './ComfyQueueButton.vue'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => null
}))

vi.mock('@/workbench/extensions/manager/utils/graphHasMissingNodes', () => ({
  graphHasMissingNodes: () => false
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {}
  }
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
        disabledTooltip: 'Disabled tooltip',
        onChange: 'On Change',
        onChangeTooltip: 'On change tooltip',
        instant: 'Instant',
        instantTooltip: 'Instant tooltip',
        stopRunInstant: 'Stop Run (Instant)',
        stopRunInstantTooltip: 'Stop running',
        runWorkflow: 'Run workflow',
        runWorkflowFront: 'Run workflow front',
        runWorkflowDisabled: 'Run workflow disabled'
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

const stubs = {
  BatchCountEdit: BatchCountEditStub,
  DropdownMenuRoot: { template: '<div><slot /></div>' },
  DropdownMenuTrigger: { template: '<div><slot /></div>' },
  DropdownMenuPortal: { template: '<div><slot /></div>' },
  DropdownMenuContent: { template: '<div><slot /></div>' },
  DropdownMenuItem: { template: '<div><slot /></div>' }
}

function renderQueueButton() {
  const pinia = createTestingPinia({ createSpy: vi.fn })

  return render(ComfyQueueButton, {
    global: {
      plugins: [pinia, i18n],
      directives: {
        tooltip: () => {}
      },
      stubs
    }
  })
}

describe('ComfyQueueButton', () => {
  it('renders the batch count control before the run button', () => {
    renderQueueButton()
    const controls = screen.getAllByTestId(/batch-count-edit|queue-button/)

    expect(controls[0]).toHaveAttribute('data-testid', 'batch-count-edit')
    expect(controls[1]).toHaveAttribute('data-testid', 'queue-button')
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

    await user!.click(screen.getByTestId('queue-button'))
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

    await user!.click(screen.getByTestId('queue-button'))
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
