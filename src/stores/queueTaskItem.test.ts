import { describe, expect, it, vi } from 'vitest'

import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import type { ResultItemType, TaskOutput } from '@/schemas/apiSchema'
import type { SerializedNodeId } from '@/types/nodeId'
import { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (path: string) => `http://localhost:8188${path}`,
    addEventListener: () => {}
  }
}))

vi.mock('@/scripts/app', () => ({ app: {} }))

vi.mock('@/platform/distribution/cloudPreviewUtil', () => ({
  appendCloudResParam: () => {}
}))

const { parseTaskOutput } = vi.hoisted(() => ({ parseTaskOutput: vi.fn() }))
vi.mock('@/stores/resultItemParsing', () => ({ parseTaskOutput }))

function executionError(
  overrides: Partial<NonNullable<JobListItem['execution_error']>> = {}
): NonNullable<JobListItem['execution_error']> {
  return {
    node_id: '1',
    node_type: 'KSampler',
    exception_message: 'boom',
    exception_type: 'Error',
    traceback: [],
    current_inputs: {},
    current_outputs: {},
    ...overrides
  }
}

function job(over: Partial<JobListItem> = {}): JobListItem {
  return {
    id: 'job-1',
    status: 'completed',
    create_time: 1000,
    priority: 0,
    ...over
  }
}

function result(filename: string, type: ResultItemType = 'output') {
  return new ResultItemImpl({
    filename,
    subfolder: '',
    type,
    nodeId: '1' as SerializedNodeId,
    mediaType: 'images'
  })
}

describe('TaskItemImpl', () => {
  it('derives history/running flags and a status-qualified key', () => {
    const running = new TaskItemImpl(job({ id: 'a', status: 'in_progress' }))
    expect(running.isRunning).toBe(true)
    expect(running.isHistory).toBe(false)
    expect(running.key).toBe('aRunning')

    expect(new TaskItemImpl(job({ status: 'completed' })).isHistory).toBe(true)
  })

  it('uses explicitly provided flat outputs', () => {
    const outputs = [result('a.png')]
    const task = new TaskItemImpl(job(), undefined, outputs)
    expect(task.flatOutputs).toBe(outputs)
  })

  it('parses outputs lazily when flat outputs are not supplied', () => {
    const parsed = [result('p.png')]
    parseTaskOutput.mockReturnValueOnce(parsed)
    const outputs: TaskOutput = { '1': { images: [] } }
    const task = new TaskItemImpl(job(), outputs)
    expect(parseTaskOutput).toHaveBeenCalled()
    expect(task.flatOutputs).toBe(parsed)
  })

  it('synthesizes outputs from preview_output when none are provided', () => {
    parseTaskOutput.mockReturnValueOnce([])
    const preview = { nodeId: '5', mediaType: 'images', filename: 'prev.png' }
    new TaskItemImpl(job({ preview_output: preview }))
    expect(parseTaskOutput).toHaveBeenCalledWith({
      '5': { images: [preview] }
    })
  })

  it('prefers the last saved output over temp previews for previewOutput', () => {
    const temp = result('temp.png', 'temp')
    const saved = result('saved.png', 'output')
    const task = new TaskItemImpl(job(), undefined, [temp, saved])
    expect(task.previewOutput).toBe(saved)

    const onlyTemp = new TaskItemImpl(job(), undefined, [temp])
    expect(onlyTemp.previewOutput).toBe(temp)
  })

  it('reports interrupted only for an interrupt-typed failure', () => {
    expect(
      new TaskItemImpl(
        job({
          status: 'failed',
          execution_error: executionError({
            exception_type: 'InterruptProcessingException'
          })
        })
      ).interrupted
    ).toBe(true)
    expect(
      new TaskItemImpl(
        job({
          status: 'failed',
          execution_error: executionError({ exception_type: 'Other' })
        })
      ).interrupted
    ).toBe(false)
    expect(
      new TaskItemImpl(
        job({
          status: 'completed',
          execution_error: executionError({
            exception_type: 'InterruptProcessingException'
          })
        })
      ).interrupted
    ).toBe(false)
  })

  it('surfaces error message and passthrough job fields', () => {
    const task = new TaskItemImpl(
      job({
        status: 'failed',
        outputs_count: 3,
        workflow_id: 'wf-9',
        execution_error: executionError({ exception_message: 'boom' })
      })
    )
    expect(task.errorMessage).toBe('boom')
    expect(task.outputsCount).toBe(3)
    expect(task.workflowId).toBe('wf-9')
  })

  it('computes execution time only when both timestamps exist', () => {
    expect(
      new TaskItemImpl(
        job({ execution_start_time: 1000, execution_end_time: 3000 })
      ).executionTimeInSeconds
    ).toBe(2)
    expect(
      new TaskItemImpl(job({ execution_start_time: 1000 })).executionTime
    ).toBeUndefined()
    expect(
      new TaskItemImpl(job({ execution_end_time: 3000 })).executionTime
    ).toBeUndefined()
  })

  it('flatten returns itself when not completed', () => {
    const running = new TaskItemImpl(job({ status: 'in_progress' }))
    expect(running.flatten()).toEqual([running])
  })

  it('flatten expands a completed task into one task per output', () => {
    const outputs = [result('a.png'), result('b.png')]
    const task = new TaskItemImpl(
      job({ id: 'j', status: 'completed' }),
      undefined,
      outputs
    )

    const flattened = task.flatten()

    expect(flattened).toHaveLength(2)
    expect(flattened.map((t) => t.jobId)).toEqual(['j-0', 'j-1'])
  })
})
