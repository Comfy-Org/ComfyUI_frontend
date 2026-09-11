import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ResultItem } from '@/schemas/apiSchema'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

import { getExecutionImage } from './executionLifecycle'
import {
  EXECUTION_ACCEPTANCE_TIMEOUT_MS,
  EXECUTION_CONNECTION_TIMEOUT_MS,
  useExecutionLifecycleStore
} from './executionLifecycleStore'

const selector = {
  nodeId: createNodeExecutionId([toNodeId(9)]),
  nodeType: 'SaveImage'
}
const prompt = {
  '9': { class_type: 'SaveImage', inputs: {}, _meta: { title: 'Result' } },
  '28': {
    class_type: 'SaveImage',
    inputs: {},
    _meta: { title: 'Intermediate' }
  }
} satisfies ComfyApiWorkflow

function output(
  jobId: string,
  nodeId = '9',
  type: ResultItem['type'] = 'output'
) {
  useExecutionLifecycleStore().receiveOutput({
    prompt_id: jobId,
    node: nodeId,
    display_node: nodeId,
    output: { images: [{ filename: `${jobId}-${nodeId}-${type}.png`, type }] }
  })
}

function submit(requestId = 1) {
  const store = useExecutionLifecycleStore()
  const handle = store.beginSubmission(requestId, 'workflow-a')
  store.prepareSubmission(requestId, 'workflow-a', prompt)
  return handle
}

describe('execution submission handles', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    useExecutionLifecycleStore().$dispose()
  })

  it.for([
    ['output', 'success', 'accept'],
    ['success', 'output', 'accept'],
    ['accept', 'output', 'success'],
    ['accept', 'success', 'output'],
    ['output', 'accept', 'success'],
    ['success', 'accept', 'output']
  ])('retains output and completion across %j', (order) => {
    const store = useExecutionLifecycleStore()
    const handle = submit()
    const completedAt = Date.now()
    for (const event of order) {
      if (event === 'accept') store.acceptSubmission(1, 'job-a')
      if (event === 'output') output('job-a')
      if (event === 'success') store.succeedJob('job-a', completedAt)
    }
    expect(handle.state.value).toMatchObject({
      phase: 'accepted',
      jobId: 'job-a',
      job: { phase: 'succeeded', completedAt }
    })
    expect(getExecutionImage(handle.state.value, selector)?.filename).toBe(
      'job-a-9-output.png'
    )
  })

  it('binds concurrent submissions of the same workflow by their HTTP responses', () => {
    const store = useExecutionLifecycleStore()
    const first = submit(1)
    const second = submit(2)
    output('old-job')
    output('job-b')
    output('job-a')
    store.succeedJob('job-b', 200)
    store.acceptSubmission(2, 'job-b')
    store.acceptSubmission(1, 'job-a')
    expect(getExecutionImage(first.state.value, selector)?.filename).toBe(
      'job-a-9-output.png'
    )
    expect(getExecutionImage(second.state.value, selector)?.filename).toBe(
      'job-b-9-output.png'
    )
    expect(first.state.value).toMatchObject({ job: { phase: 'running' } })
    expect(second.state.value).toMatchObject({
      job: { phase: 'succeeded', completedAt: 200 }
    })
  })

  it('keeps the first job of a batch instead of adopting subsequent acceptance', () => {
    const store = useExecutionLifecycleStore()
    const handle = submit()
    store.acceptSubmission(1, 'job-a')
    store.acceptSubmission(1, 'job-b')
    output('job-b')
    store.succeedJob('job-b')
    store.rejectSubmission(1, 'submission_failed')
    expect(handle.state.value).toMatchObject({
      phase: 'accepted',
      jobId: 'job-a',
      job: { phase: 'running' }
    })
    expect(getExecutionImage(handle.state.value, selector)).toBeNull()
  })

  it('rejects a request prepared from a different workflow', () => {
    const store = useExecutionLifecycleStore()
    const handle = store.beginSubmission(1, 'workflow-a')
    store.prepareSubmission(1, 'workflow-b', prompt)
    store.acceptSubmission(1, 'job-a')
    output('job-a')
    expect(handle.state.value).toEqual({
      phase: 'rejected',
      reason: 'workflow_changed'
    })
  })

  it('requires the declared output node type in the submitted prompt', () => {
    const store = useExecutionLifecycleStore()
    const handle = store.beginSubmission(1, 'workflow-a')
    store.prepareSubmission(1, 'workflow-a', {
      ...prompt,
      '9': { ...prompt['9'], class_type: 'PreviewImage' }
    })
    store.acceptSubmission(1, 'job-a')
    output('job-a')
    expect(getExecutionImage(handle.state.value, selector)).toBeNull()
  })

  it('keeps terminal success and its timestamp through duplicate events and queue cleanup', () => {
    const store = useExecutionLifecycleStore()
    const handle = submit()
    store.succeedJob('job-a', 100)
    store.cancelJob('job-a')
    store.acceptSubmission(1, 'job-a')
    store.succeedJob('job-a', 200)
    store.failJob('job-a')
    output('job-a')
    expect(handle.state.value).toMatchObject({
      job: { phase: 'succeeded', completedAt: 100 }
    })
    expect(getExecutionImage(handle.state.value, selector)).not.toBeNull()
  })

  it.for(['failed', 'cancelled'] as const)(
    'retains %s before acceptance and ignores late success',
    (outcome) => {
      const store = useExecutionLifecycleStore()
      const handle = submit()
      output('job-a')
      if (outcome === 'failed') store.failJob('job-a')
      else store.cancelJob('job-a')
      store.acceptSubmission(1, 'job-a')
      store.succeedJob('job-a')
      output('job-a')
      expect(handle.state.value).toMatchObject({ job: { phase: outcome } })
      expect(getExecutionImage(handle.state.value, selector)).toBeNull()
    }
  )

  it.for(['submission_rejected', 'submission_failed'] as const)(
    'records %s without waiting for a correlation timeout',
    (reason) => {
      const store = useExecutionLifecycleStore()
      const handle = submit()
      store.rejectSubmission(1, reason)
      vi.advanceTimersByTime(EXECUTION_ACCEPTANCE_TIMEOUT_MS)
      store.acceptSubmission(1, 'job-a')
      expect(handle.state.value).toEqual({ phase: 'rejected', reason })
    }
  )

  it('abandons unresolved acceptance without adopting a later job', () => {
    const store = useExecutionLifecycleStore()
    const handle = submit()
    output('job-a')
    store.succeedJob('job-a')
    vi.advanceTimersByTime(EXECUTION_ACCEPTANCE_TIMEOUT_MS)
    store.acceptSubmission(1, 'job-a')
    expect(handle.state.value).toEqual({
      phase: 'abandoned',
      previousPhase: 'pending',
      reason: 'acceptance_timeout'
    })
  })

  it('does not apply the acceptance deadline to a job waiting for a machine', () => {
    const store = useExecutionLifecycleStore()
    const handle = submit()
    store.acceptSubmission(1, 'job-a')
    vi.advanceTimersByTime(EXECUTION_ACCEPTANCE_TIMEOUT_MS * 3)
    expect(handle.state.value).toMatchObject({ phase: 'accepted' })
  })

  it('allows reconnection and keeps success received while offline', () => {
    const store = useExecutionLifecycleStore()
    const handle = submit()
    store.acceptSubmission(1, 'job-a')
    store.connectionLost()
    vi.advanceTimersByTime(EXECUTION_CONNECTION_TIMEOUT_MS - 1)
    store.connectionRestored()
    vi.advanceTimersByTime(EXECUTION_CONNECTION_TIMEOUT_MS)
    expect(handle.state.value).toMatchObject({ job: { phase: 'running' } })
    store.connectionLost()
    store.succeedJob('job-a', 100)
    vi.advanceTimersByTime(EXECUTION_CONNECTION_TIMEOUT_MS)
    expect(handle.state.value).toMatchObject({
      job: { phase: 'succeeded', completedAt: 100 }
    })
  })

  it('abandons an accepted job when the connection grace expires', () => {
    const store = useExecutionLifecycleStore()
    const handle = submit()
    store.acceptSubmission(1, 'job-a')
    store.connectionLost()
    vi.advanceTimersByTime(EXECUTION_CONNECTION_TIMEOUT_MS)
    store.connectionRestored()
    store.succeedJob('job-a')
    expect(handle.state.value).toEqual({
      phase: 'abandoned',
      previousPhase: 'accepted',
      reason: 'connection_timeout',
      jobId: 'job-a'
    })
  })

  it('selects only the declared result and upgrades a preview to a saved image', () => {
    const store = useExecutionLifecycleStore()
    const handle = submit()
    output('job-a', '28')
    output('job-a', '9', 'temp')
    store.acceptSubmission(1, 'job-a')
    expect(getExecutionImage(handle.state.value, selector)?.type).toBe('temp')
    output('job-a')
    output('job-a', '9', 'temp')
    expect(getExecutionImage(handle.state.value, selector)?.filename).toBe(
      'job-a-9-output.png'
    )
  })

  it('releases timers and pending observers when the execution store is cleared', () => {
    const store = useExecutionLifecycleStore()
    const pending = submit(1)
    const accepted = submit(2)
    store.acceptSubmission(2, 'job-b')
    store.connectionLost()
    store.clear()
    vi.advanceTimersByTime(EXECUTION_CONNECTION_TIMEOUT_MS)
    expect(pending.state.value).toMatchObject({ phase: 'rejected' })
    expect(accepted.state.value).toMatchObject({ job: { phase: 'cancelled' } })
  })
})
