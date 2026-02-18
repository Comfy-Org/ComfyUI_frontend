import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
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

const SplitButtonStub = defineComponent({
  name: 'SplitButton',
  props: {
    label: {
      type: String,
      default: ''
    },
    severity: {
      type: String,
      default: 'primary'
    }
  },
  template: `
    <button
      data-testid="split-button"
      :data-label="label"
      :data-severity="severity"
    >
      <slot name="icon" />
    </button>
  `
})

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
        stopRunInstantTooltip:
          'Stop instant auto queue and cancel the current run',
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

function createWrapper() {
  const pinia = createTestingPinia({ createSpy: vi.fn })

  return mount(ComfyQueueButton, {
    global: {
      plugins: [pinia, i18n],
      directives: {
        tooltip: () => {}
      },
      stubs: {
        SplitButton: SplitButtonStub,
        BatchCountEdit: true
      }
    }
  })
}

describe('ComfyQueueButton', () => {
  it('keeps the run instant presentation while idle', async () => {
    const wrapper = createWrapper()
    const queueSettingsStore = useQueueSettingsStore()

    queueSettingsStore.mode = 'instant'
    await nextTick()

    const splitButton = wrapper.get('[data-testid="queue-button"]')

    expect(splitButton.attributes('data-label')).toBe('Run (Instant)')
    expect(splitButton.attributes('data-severity')).toBe('primary')
    expect(wrapper.find('.icon-\\[lucide--fast-forward\\]').exists()).toBe(true)
  })

  it('switches to stop presentation for active instant auto queue', async () => {
    const wrapper = createWrapper()
    const queueSettingsStore = useQueueSettingsStore()
    const queueStore = useQueueStore()

    queueSettingsStore.mode = 'instant'
    queueSettingsStore.instantAutoQueueActive = true
    queueStore.runningTasks = [createTask('run-1', 'in_progress')]
    await nextTick()

    const splitButton = wrapper.get('[data-testid="queue-button"]')

    expect(splitButton.attributes('data-label')).toBe('Stop Run (Instant)')
    expect(splitButton.attributes('data-severity')).toBe('danger')
    expect(wrapper.find('.icon-\\[lucide--square\\]').exists()).toBe(true)
  })

  it('stops active instant mode while keeping instant selected when jobs clear', async () => {
    const wrapper = createWrapper()
    const queueSettingsStore = useQueueSettingsStore()
    const queueStore = useQueueStore()
    const commandStore = useCommandStore()

    queueSettingsStore.mode = 'instant'
    queueSettingsStore.instantAutoQueueActive = true
    queueStore.runningTasks = [createTask('run-1', 'in_progress')]
    await nextTick()

    const clickPromise = wrapper
      .get('[data-testid="queue-button"]')
      .trigger('click')
    await nextTick()

    expect(queueSettingsStore.mode).toBe('instant')
    expect(queueSettingsStore.instantAutoQueueActive).toBe(false)
    const splitButtonWhileStopping = wrapper.get('[data-testid="queue-button"]')
    expect(splitButtonWhileStopping.attributes('data-label')).toBe(
      'Run (Instant)'
    )
    expect(splitButtonWhileStopping.attributes('data-severity')).toBe('primary')
    expect(wrapper.find('.icon-\\[lucide--fast-forward\\]').exists()).toBe(true)

    queueStore.runningTasks = []
    await nextTick()
    await clickPromise
    await nextTick()

    expect(commandStore.execute).toHaveBeenCalledWith('Comfy.Interrupt')
    expect(commandStore.execute).not.toHaveBeenCalledWith(
      'Comfy.QueuePrompt',
      expect.anything()
    )

    const splitButton = wrapper.get('[data-testid="queue-button"]')
    expect(queueSettingsStore.mode).toBe('instant')
    expect(queueSettingsStore.instantAutoQueueActive).toBe(false)
    expect(splitButton.attributes('data-label')).toBe('Run (Instant)')
    expect(splitButton.attributes('data-severity')).toBe('primary')
    expect(wrapper.find('.icon-\\[lucide--fast-forward\\]').exists()).toBe(true)
  })

  it('activates instant auto queue when queueing again', async () => {
    const wrapper = createWrapper()
    const queueSettingsStore = useQueueSettingsStore()
    const commandStore = useCommandStore()

    queueSettingsStore.mode = 'instant'
    queueSettingsStore.instantAutoQueueActive = false
    await nextTick()

    await wrapper.get('[data-testid="queue-button"]').trigger('click')
    await nextTick()

    expect(queueSettingsStore.instantAutoQueueActive).toBe(true)
    expect(commandStore.execute).toHaveBeenCalledWith('Comfy.QueuePrompt', {
      metadata: {
        subscribe_to_run: false,
        trigger_source: 'button'
      }
    })
  })
})
