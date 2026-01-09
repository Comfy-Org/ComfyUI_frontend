import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'

import type { ExecutionErrorWsMessage } from '@/schemas/apiSchema'
import type { TaskItemImpl } from '@/queue/stores/queueStore'
import type {
  JobErrorDialogService,
  UseJobErrorReportingOptions
} from '@/queue/components/job/useJobErrorReporting'
import * as jobErrorReporting from '@/queue/components/job/useJobErrorReporting'

const createExecutionErrorMessage = (
  overrides: Partial<ExecutionErrorWsMessage> = {}
): ExecutionErrorWsMessage => ({
  prompt_id: 'prompt',
  timestamp: 100,
  node_id: 'node-1',
  node_type: 'KSampler',
  executed: [],
  exception_message: 'default failure',
  exception_type: 'RuntimeError',
  traceback: ['Trace line'],
  current_inputs: {},
  current_outputs: {},
  ...overrides
})

const createTaskWithMessages = (
  messages: Array<[string, unknown]> | undefined = []
): TaskItemImpl =>
  ({
    status: {
      status_str: 'error',
      completed: false,
      messages
    }
  }) as TaskItemImpl

describe('extractExecutionError', () => {
  it('returns null when task has no execution error messages', () => {
    expect(jobErrorReporting.extractExecutionError(null)).toBeNull()
    expect(
      jobErrorReporting.extractExecutionError({
        status: undefined
      } as TaskItemImpl)
    ).toBeNull()
    expect(
      jobErrorReporting.extractExecutionError({
        status: {
          status_str: 'error',
          completed: false,
          messages: {} as unknown as Array<[string, unknown]>
        }
      } as TaskItemImpl)
    ).toBeNull()
    expect(
      jobErrorReporting.extractExecutionError(createTaskWithMessages([]))
    ).toBeNull()
    expect(
      jobErrorReporting.extractExecutionError(
        createTaskWithMessages([
          ['execution_start', { prompt_id: 'prompt', timestamp: 1 }]
        ] as Array<[string, unknown]>)
      )
    ).toBeNull()
  })

  it('returns detail and message for execution_error entries', () => {
    const detail = createExecutionErrorMessage({ exception_message: 'Kaboom' })
    const result = jobErrorReporting.extractExecutionError(
      createTaskWithMessages([
        ['execution_success', { prompt_id: 'prompt', timestamp: 2 }],
        ['execution_error', detail]
      ] as Array<[string, unknown]>)
    )
    expect(result).toEqual({
      detail,
      message: 'Kaboom'
    })
  })

  it('falls back to an empty message when the tuple lacks detail', () => {
    const result = jobErrorReporting.extractExecutionError(
      createTaskWithMessages([
        ['execution_error'] as unknown as [string, ExecutionErrorWsMessage]
      ])
    )
    expect(result).toEqual({ detail: undefined, message: '' })
  })
})

describe('useJobErrorReporting', () => {
  let taskState = ref<TaskItemImpl | null>(null)
  let taskForJob: ComputedRef<TaskItemImpl | null>
  let copyToClipboard: UseJobErrorReportingOptions['copyToClipboard']
  let showExecutionErrorDialog: JobErrorDialogService['showExecutionErrorDialog']
  let showErrorDialog: JobErrorDialogService['showErrorDialog']
  let dialog: JobErrorDialogService
  let composable: ReturnType<typeof jobErrorReporting.useJobErrorReporting>

  beforeEach(() => {
    taskState = ref<TaskItemImpl | null>(null)
    taskForJob = computed(() => taskState.value)
    copyToClipboard = vi.fn()
    showExecutionErrorDialog = vi.fn()
    showErrorDialog = vi.fn()
    dialog = {
      showExecutionErrorDialog,
      showErrorDialog
    }
    composable = jobErrorReporting.useJobErrorReporting({
      taskForJob,
      copyToClipboard,
      dialog
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes a computed message that reflects the current task error', () => {
    taskState.value = createTaskWithMessages([
      [
        'execution_error',
        createExecutionErrorMessage({ exception_message: 'First failure' })
      ]
    ])
    expect(composable.errorMessageValue.value).toBe('First failure')

    taskState.value = createTaskWithMessages([
      [
        'execution_error',
        createExecutionErrorMessage({ exception_message: 'Second failure' })
      ]
    ])
    expect(composable.errorMessageValue.value).toBe('Second failure')
  })

  it('only calls the copy handler when a message exists', () => {
    taskState.value = createTaskWithMessages([
      [
        'execution_error',
        createExecutionErrorMessage({ exception_message: 'Clipboard failure' })
      ]
    ])
    composable.copyErrorMessage()
    expect(copyToClipboard).toHaveBeenCalledTimes(1)
    expect(copyToClipboard).toHaveBeenCalledWith('Clipboard failure')

    vi.mocked(copyToClipboard).mockClear()
    taskState.value = createTaskWithMessages([])
    composable.copyErrorMessage()
    expect(copyToClipboard).not.toHaveBeenCalled()
  })

  it('prefers the detailed execution dialog when detail is available', () => {
    const detail = createExecutionErrorMessage({
      exception_message: 'Detailed failure'
    })
    taskState.value = createTaskWithMessages([['execution_error', detail]])
    composable.reportJobError()
    expect(showExecutionErrorDialog).toHaveBeenCalledTimes(1)
    expect(showExecutionErrorDialog).toHaveBeenCalledWith(detail)
    expect(showErrorDialog).not.toHaveBeenCalled()
  })

  it('shows a fallback dialog when only a message is available', () => {
    const message = 'Queue job error'
    taskState.value = createTaskWithMessages([])
    const valueSpy = vi
      .spyOn(composable.errorMessageValue, 'value', 'get')
      .mockReturnValue(message)

    expect(composable.errorMessageValue.value).toBe(message)
    composable.reportJobError()
    expect(showExecutionErrorDialog).not.toHaveBeenCalled()
    expect(showErrorDialog).toHaveBeenCalledTimes(1)
    const [errorArg, optionsArg] = vi.mocked(showErrorDialog).mock.calls[0]
    expect(errorArg).toBeInstanceOf(Error)
    expect(errorArg.message).toBe(message)
    expect(optionsArg).toEqual({ reportType: 'queueJobError' })
    valueSpy.mockRestore()
  })

  it('does nothing when no error could be extracted', () => {
    taskState.value = createTaskWithMessages([])
    composable.reportJobError()
    expect(showExecutionErrorDialog).not.toHaveBeenCalled()
    expect(showErrorDialog).not.toHaveBeenCalled()
  })
})
