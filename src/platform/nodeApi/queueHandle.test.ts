import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import { api } from '@/scripts/api'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'

import { createComfyApi } from './comfyApi'
import { mayRun } from './queueHandle'
import type { RunRejectedEvent } from './queueHandle'

const { queuePrompt } = vi.hoisted(() => ({
  queuePrompt: vi.fn(async (..._args: unknown[]) => true)
}))
vi.mock('@/scripts/app', () => ({ app: { queuePrompt } }))

function graphWith(...titles: string[]) {
  const graph = new LGraph()
  for (const title of titles) {
    const node = new LGraphNode(title)
    node.addOutput('out', 'IMAGE')
    graph.add(node)
  }
  return graph
}

describe('comfy.queue', () => {
  const cleanups: (() => void)[] = []
  const track = (cleanup: () => void) => {
    cleanups.push(cleanup)
    return cleanup
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    queuePrompt.mockClear()
  })

  afterEach(() => {
    while (cleanups.length) cleanups.pop()!()
  })

  it('runs the whole workflow', async () => {
    const comfy = createComfyApi(() => graphWith('A'))
    await comfy.queue.run()

    expect(queuePrompt).toHaveBeenCalledWith(0, 1)
  })

  it('passes the batch count through', async () => {
    const comfy = createComfyApi(() => graphWith('A'))
    await comfy.queue.run({ batch: 4 })

    expect(queuePrompt).toHaveBeenCalledWith(0, 4)
  })

  it.for([0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid batch count %s',
    async (batch) => {
      const comfy = createComfyApi(() => graphWith('A'))

      await expect(comfy.queue.run({ batch })).rejects.toThrow(
        /positive integer/
      )
      expect(queuePrompt).not.toHaveBeenCalled()
    }
  )

  it('runs only the given nodes', async () => {
    // Partial execution is a host feature; packs used to get here by rewriting
    // prompt.output by hand, which is the surface we are retiring.
    const graph = graphWith('A', 'B')
    const comfy = createComfyApi(() => graph)
    const target = comfy.graph.nodes()[1]

    await comfy.queue.run({ nodes: [target] })

    expect(queuePrompt).toHaveBeenCalledWith(0, 1, [target.id])
  })

  it('refuses an empty node list rather than running everything', async () => {
    // A filter that matched nothing must not silently run the whole graph.
    const comfy = createComfyApi(() => graphWith('A'))

    await expect(comfy.queue.run({ nodes: [] })).rejects.toThrow(
      /at least one node/
    )
    expect(queuePrompt).not.toHaveBeenCalled()
  })

  it('refuses a node that has left the graph', async () => {
    const graph = graphWith('A')
    const comfy = createComfyApi(() => graph)
    const node = comfy.graph.nodes()[0]
    graph.remove(graph.getNodeById(toNodeId(node.id))!)

    await expect(comfy.queue.run({ nodes: [node] })).rejects.toThrow(
      /not in the graph/
    )
    expect(queuePrompt).not.toHaveBeenCalled()
  })

  it('reports how many runs are waiting, and when that changes', async () => {
    // Packs re-implemented app.ui.lastQueueSize from the backend's status
    // message to decide whether a button says Run or Cancel.
    const comfy = createComfyApi(() => graphWith('A'))
    const seen: number[] = []
    track(comfy.queue.onPendingChanged((n) => seen.push(n)))

    expect(comfy.queue.pending()).toBe(0)
    useQueuePendingTaskCountStore().count = 3
    await nextTick()

    expect(comfy.queue.pending()).toBe(3)
    expect(seen).toEqual([3])
  })

  it('cancels the running job and reports an interruption', async () => {
    const interrupt = vi.spyOn(api, 'interrupt').mockResolvedValue(undefined)
    const comfy = createComfyApi(() => graphWith('A'))
    const interrupted = vi.fn()
    track(comfy.queue.onInterrupted(interrupted))

    await comfy.queue.interrupt()
    expect(interrupt).toHaveBeenCalledWith(null)

    api.dispatchCustomEvent('execution_interrupted', {
      prompt_id: 'p',
      timestamp: 0,
      node_id: '1',
      node_type: 'X',
      executed: []
    })
    expect(interrupted).toHaveBeenCalledTimes(1)
  })

  it('disables auto-queue without reaching into host controls', () => {
    const comfy = createComfyApi(() => graphWith('A'))
    useQueueSettingsStore().mode = 'instant-running'

    comfy.queue.disableAutoQueue()

    expect(useQueueSettingsStore().mode).toBe('disabled')
  })

  it('reads and changes automatic queue modes', () => {
    const comfy = createComfyApi(() => graphWith('A'))
    const settings = useQueueSettingsStore()
    settings.mode = 'instant-idle'

    expect(comfy.queue.autoQueueMode()).toBe('instant')

    comfy.queue.setAutoQueueMode('change')
    expect(settings.mode).toBe('change')

    comfy.queue.setAutoQueueMode('instant')
    expect(settings.mode).toBe('instant-running')
  })

  it('reads and changes the default batch count', () => {
    const comfy = createComfyApi(() => graphWith('A'))
    const settings = useQueueSettingsStore()
    settings.batchCount = 3

    expect(comfy.queue.batchCount()).toBe(3)

    comfy.queue.setBatchCount(5)
    expect(settings.batchCount).toBe(5)

    expect(() => comfy.queue.setBatchCount(0)).toThrow(/positive integer/)
    expect(settings.batchCount).toBe(5)
  })

  it('lets a guard cancel a run, and every guard is asked', async () => {
    // onBeforeRun only observes. Packs that needed to STOP a run — confirm a
    // prompt, validate a field — wrapped app.queuePrompt to do it.
    const comfy = createComfyApi(() => graphWith('A'))
    const second = vi.fn(() => true)
    const stopFirst = track(comfy.queue.guard(() => false))
    const stopSecond = track(comfy.queue.guard(second))

    expect(await mayRun()).toBe(false)
    expect(second).toHaveBeenCalledTimes(1)

    stopFirst()
    stopSecond()
  })

  it('runs when a guard allows it, and after one is removed', async () => {
    const comfy = createComfyApi(() => graphWith('A'))
    const stop = track(comfy.queue.guard(async () => false))
    expect(await mayRun()).toBe(false)

    stop()
    expect(await mayRun()).toBe(true)
  })

  it('clears the timeout after guards settle', async () => {
    vi.useFakeTimers()
    const comfy = createComfyApi(() => graphWith('A'))
    const stop = track(comfy.queue.guard(() => true))

    await mayRun()

    expect(vi.getTimerCount()).toBe(0)
    stop()
  })

  it('does not let a throwing guard cancel the run', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const comfy = createComfyApi(() => graphWith('A'))
    const stop = track(
      comfy.queue.guard(() => {
        throw new Error('pack is broken')
      })
    )

    expect(await mayRun()).toBe(true)
    stop()
  })

  it('abandons a guard that never settles rather than stranding the user', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const comfy = createComfyApi(() => graphWith('A'))
    const stop = track(comfy.queue.guard(() => new Promise<boolean>(() => {})))

    const verdict = mayRun()
    await vi.advanceTimersByTimeAsync(6000)

    expect(await verdict).toBe(true)
    stop()
  })

  it('names the prompts the backend accepted, and those it refused', () => {
    // onBeforeRun fires either way, so without this a pack cannot tell a run
    // that started from one that never did.
    const comfy = createComfyApi(() => graphWith('A'))
    const seen: unknown[] = []
    track(comfy.queue.onAfterRun((e) => seen.push(e)))

    api.dispatchCustomEvent('promptQueued', {
      number: 0,
      batchCount: 2,
      promptIds: ['abc'],
      rejectedCount: 1
    })

    expect(seen).toEqual([{ promptIds: ['abc'], rejected: 1 }])
  })

  it('reports the executable node count for each accepted submission', () => {
    const comfy = createComfyApi(() => graphWith('A'))
    const seen: unknown[] = []
    track(comfy.queue.onAfterRun((event) => seen.push(event)))

    Reflect.apply(api.dispatchCustomEvent, api, [
      'promptQueued',
      {
        number: 0,
        batchCount: 1,
        promptIds: ['abc'],
        submissions: [{ promptId: 'abc', nodeCount: 3 }]
      }
    ])

    expect(seen).toEqual([
      {
        promptIds: ['abc'],
        submissions: [{ promptId: 'abc', nodeCount: 3 }],
        rejected: 0
      }
    ])
  })

  it('publishes a frozen prompt rejection with node validation details', () => {
    const comfy = createComfyApi(() => graphWith('A'))
    const seen: RunRejectedEvent[] = []
    track(comfy.queue.onRejected((event) => seen.push(event)))
    Reflect.apply(api.dispatchCustomEvent, api, [
      'promptRejected',
      {
        status: 400,
        response: {
          error: {
            type: 'prompt_outputs_failed_validation',
            message: 'Prompt outputs failed validation',
            details: 'See node errors'
          },
          node_errors: {
            '12': {
              class_type: 'KSampler',
              dependent_outputs: [],
              errors: [
                {
                  type: 'required_input_missing',
                  message: 'Required input is missing: positive',
                  details: '',
                  extra_info: { input_name: 'positive' }
                }
              ]
            }
          }
        }
      }
    ])

    expect(seen).toEqual([
      {
        status: 400,
        error: {
          type: 'prompt_outputs_failed_validation',
          message: 'Prompt outputs failed validation',
          details: 'See node errors'
        },
        nodeErrors: [
          {
            nodeId: '12',
            nodeType: 'KSampler',
            errors: [
              {
                type: 'required_input_missing',
                message: 'Required input is missing: positive',
                details: '',
                inputName: 'positive'
              }
            ]
          }
        ]
      }
    ])
    expect(Object.isFrozen(seen[0])).toBe(true)
    expect(Object.isFrozen(Reflect.get(seen[0], 'nodeErrors'))).toBe(true)
  })

  it('runs the cleanup a listener returns when the attempt ends', () => {
    // The motivating case: unmute a branch to build the prompt, put it back
    // afterwards. It must fire on a refused attempt too, or the graph is left
    // visibly altered until the next run.
    const comfy = createComfyApi(() => graphWith('A'))
    const order: string[] = []
    track(
      comfy.queue.onBeforeRun(() => {
        order.push('setup')
        return () => order.push('cleanup')
      })
    )

    api.dispatchCustomEvent('promptQueueing', { requestId: 1, batchCount: 1 })
    api.dispatchCustomEvent('promptQueueAttemptEnded', {
      requestId: 1,
      queued: 0,
      rejected: 1
    })

    expect(order).toEqual(['setup', 'cleanup'])
  })

  it('does not run a cleanup twice', () => {
    // Re-running a stale cleanup would undo a mutation the next attempt had
    // just made.
    const comfy = createComfyApi(() => graphWith('A'))
    const cleanup = vi.fn()
    track(comfy.queue.onBeforeRun(() => cleanup))

    api.dispatchCustomEvent('promptQueueing', { requestId: 1, batchCount: 1 })
    api.dispatchCustomEvent('promptQueueAttemptEnded', {
      requestId: 1,
      queued: 1,
      rejected: 0
    })
    api.dispatchCustomEvent('promptQueueAttemptEnded', {
      requestId: 1,
      queued: 1,
      rejected: 0
    })

    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('keeps onAfterRun meaning a run that actually started', () => {
    // Four packs converted widget.afterQueued onto this. A batch counter that
    // also counted refused submissions would advance the batch when nothing
    // ran, so the attempt-ended signal must not reach here.
    const comfy = createComfyApi(() => graphWith('A'))
    const after = vi.fn()
    track(comfy.queue.onAfterRun(after))

    api.dispatchCustomEvent('promptQueueAttemptEnded', {
      requestId: 1,
      queued: 0,
      rejected: 1
    })

    expect(after).not.toHaveBeenCalled()
  })

  it('reports runs starting and finishing being submitted', () => {
    const comfy = createComfyApi(() => graphWith('A'))
    const before = vi.fn()
    const after = vi.fn()
    const stop = track(comfy.queue.onBeforeRun(before))
    track(comfy.queue.onAfterRun(after))

    api.dispatchCustomEvent('promptQueueing', { requestId: 1, batchCount: 1 })
    api.dispatchCustomEvent('promptQueued', { number: 0, batchCount: 1 })
    expect(before).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledTimes(1)

    stop()
    api.dispatchCustomEvent('promptQueueing', { requestId: 2, batchCount: 1 })
    expect(before).toHaveBeenCalledTimes(1)
  })
})
