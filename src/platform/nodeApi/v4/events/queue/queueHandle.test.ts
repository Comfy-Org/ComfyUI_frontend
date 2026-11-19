import { reportError } from '@comfyorg/telemetry/reportError'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { RunSubmittedEvent } from '@/platform/nodeApi/v4/types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

function queueApi() {
  const { comfy, host } = createComfyApi({ getGraph: () => null })
  return { queue: comfy.queue, host: host.queue }
}

function runStarts(requestId = 1) {
  api.dispatchCustomEvent('promptQueueing', { requestId, batchCount: 1 })
}

function runQueued(requestId?: number) {
  api.dispatchCustomEvent('promptQueued', {
    number: 0,
    batchCount: 1,
    requestId
  })
}

describe('queue.onBeforeRun', () => {
  it('calls a listener as each run starts, and its cleanup once the queue settles', () => {
    const { queue, host } = queueApi()
    const order: string[] = []
    queue.onBeforeRun(() => {
      order.push('start')
      return () => order.push('cleanup')
    })

    runStarts(1)
    runStarts(2)
    host.queueSettled()
    host.queueSettled()

    expect(order).toEqual(['start', 'start', 'cleanup', 'cleanup'])
  })

  it('runs the outstanding cleanup when the listener unsubscribes, and not again', () => {
    const { queue, host } = queueApi()
    const cleanup = vi.fn()
    const stop = queue.onBeforeRun(() => cleanup)

    runStarts()
    stop()
    stop()
    host.queueSettled()
    runStarts()

    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('ignores a value that is not a cleanup', () => {
    const { queue, host } = queueApi()
    const listener = vi.fn(() => 'not a function')
    Reflect.apply(queue.onBeforeRun, queue, [listener])

    runStarts()

    expect(() => host.queueSettled()).not.toThrow()
    expect(listener).toHaveBeenCalledOnce()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a listener or a cleanup that throws, and still calls the rest', () => {
    const { queue, host } = queueApi()
    const after = vi.fn()
    const cleanup = vi.fn()
    queue.onBeforeRun(() => {
      throw new Error('listener failed')
    })
    queue.onBeforeRun(() => () => {
      throw new Error('cleanup failed')
    })
    queue.onBeforeRun(() => {
      after()
      return cleanup
    })

    runStarts()
    host.queueSettled()

    expect(after).toHaveBeenCalledOnce()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledTimes(2)
  })

  it('stops following runs once its last listener leaves', () => {
    const { queue } = queueApi()
    const removeListener = vi.spyOn(api, 'removeEventListener')
    const listener = vi.fn()
    queue.onBeforeRun(listener)()

    runStarts()

    expect(listener).not.toHaveBeenCalled()
    expect(removeListener).toHaveBeenCalledWith(
      'promptQueueing',
      expect.any(Function)
    )
  })

  it('refuses a listener that is not a function', () => {
    const { queue } = queueApi()

    expect(() => Reflect.apply(queue.onBeforeRun, queue, [1])).toThrow(
      'queue.onBeforeRun needs a function to call, not 1.'
    )
  })

  it('reports a listener whose promise rejects', async () => {
    const { queue } = queueApi()
    const broken = new Error('pack failed')
    Reflect.apply(queue.onBeforeRun, queue, [
      async () => {
        throw broken
      }
    ])

    runStarts()
    await Promise.resolve()
    await Promise.resolve()

    expect(reportError).toHaveBeenCalledWith(broken, {
      errorType: 'node_api_listener_failure',
      surface: 'platform',
      tags: { event: 'queue.onBeforeRun' }
    })
  })
})

describe('queue.onAfterRun', () => {
  it('passes the prompts each run call submitted, frozen', () => {
    const { queue, host } = queueApi()
    const events: RunSubmittedEvent[] = []
    queue.onAfterRun((event) => events.push(event))

    host.promptSubmitted(1, 'job-a', 3)
    host.promptSubmitted(2, 'job-c', 1)
    host.promptSubmitted(1, 'job-b', 4)
    runQueued(1)
    runQueued(1)

    expect(events).toEqual([
      {
        promptIds: ['job-a', 'job-b'],
        submissions: [
          { promptId: 'job-a', nodeCount: 3 },
          { promptId: 'job-b', nodeCount: 4 }
        ]
      }
    ])
    expect(Object.isFrozen(events[0])).toBe(true)
    expect(Object.isFrozen(events[0].promptIds)).toBe(true)
    expect(Object.isFrozen(events[0].submissions[0])).toBe(true)
  })

  it('stops following accepted runs once its last listener leaves', () => {
    const { queue, host } = queueApi()
    const removeListener = vi.spyOn(api, 'removeEventListener')
    const submitted = vi.fn()
    queue.onAfterRun(submitted)()

    expect(removeListener).toHaveBeenCalledWith(
      'promptQueued',
      expect.any(Function)
    )

    host.promptSubmitted(1, 'job-a', 1)
    runQueued(1)
    const again = vi.fn()
    queue.onAfterRun(again)
    host.promptSubmitted(2, 'job-b', 1)
    runQueued(2)

    expect(submitted).not.toHaveBeenCalled()
    expect(again).toHaveBeenCalledOnce()
  })

  it('says nothing for a run call that submitted no prompt, or that the host does not name', () => {
    const { queue, host } = queueApi()
    const submitted = vi.fn()
    queue.onAfterRun(submitted)
    host.promptSubmitted(1, 'job-a', 1)

    runQueued(2)
    runQueued(undefined)

    expect(submitted).not.toHaveBeenCalled()

    runQueued(1)

    expect(submitted).toHaveBeenCalledOnce()
  })

  it('forgets submissions once the queue settles', () => {
    const { queue, host } = queueApi()
    const submitted = vi.fn()
    queue.onAfterRun(submitted)

    host.promptSubmitted(1, 'job-a', 1)
    host.queueSettled()
    runQueued(1)

    expect(submitted).not.toHaveBeenCalled()
  })
})

describe('queue.onRejected', () => {
  it('tells a listener each time the host says a prompt was refused', () => {
    const { queue, host } = queueApi()
    const rejected = vi.fn()
    const stop = queue.onRejected(rejected)

    host.promptRejected()
    stop()
    stop()
    host.promptRejected()

    expect(rejected).toHaveBeenCalledOnce()
  })

  it('refuses a listener that is not a function', () => {
    const { queue } = queueApi()

    expectRefusal(
      () => Reflect.apply(queue.onRejected, queue, ['no']),
      'queue.onRejected'
    )
  })
})

describe('the queue length', () => {
  it('reads how many prompts the backend last said were waiting, and follows it', async () => {
    const { queue } = queueApi()
    const changes: number[] = []
    const stop = queue.onPendingChanged((pending) => changes.push(pending))

    useQueuePendingTaskCountStore().count = 3
    await nextTick()

    expect(queue.pending()).toBe(3)

    stop()
    useQueuePendingTaskCountStore().count = 0
    await nextTick()

    expect(queue.pending()).toBe(0)
    expect(changes).toEqual([3])
  })
})

describe('interrupting', () => {
  it('cancels the job that is running', async () => {
    const { queue } = queueApi()
    const interrupt = vi.spyOn(api, 'interrupt').mockResolvedValue()
    useExecutionStore().activeJobId = 'job-a'

    await queue.interrupt()

    expect(interrupt).toHaveBeenCalledExactlyOnceWith('job-a')
  })

  it('tells a listener when the backend says a run was interrupted, until it leaves', () => {
    const { queue } = queueApi()
    const interrupted = vi.fn()
    const stop = queue.onInterrupted(interrupted)
    const message = () =>
      api.dispatchCustomEvent('execution_interrupted', {
        prompt_id: 'job-a',
        node_id: '1',
        node_type: 'A',
        executed: [],
        timestamp: 0
      })

    message()
    stop()
    message()

    expect(interrupted).toHaveBeenCalledOnce()

    const again = vi.fn()
    queue.onInterrupted(again)
    message()

    expect(again).toHaveBeenCalledOnce()
  })
})

describe('queue.disableAutoQueue', () => {
  it('turns automatic queuing off', () => {
    const { queue } = queueApi()
    useQueueSettingsStore().mode = 'instant-running'

    queue.disableAutoQueue()

    expect(useQueueSettingsStore().mode).toBe('disabled')
  })
})
