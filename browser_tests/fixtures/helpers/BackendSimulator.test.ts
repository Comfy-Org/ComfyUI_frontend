import type { WebSocketRoute } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Frame } from '@e2e/fixtures/helpers/BackendSimulator'
import {
  BackendSimulator,
  dropFrames,
  duplicateFrame,
  interleave,
  swapFrames
} from '@e2e/fixtures/helpers/BackendSimulator'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'

interface SentFrame {
  type: string
  data: Record<string, unknown>
}

/** Seeds every schedule assertion runs over, so none of them can be lucky. */
const SEEDS = [0, 1, 3, 7, 42, 99, 12345]

function harness() {
  const sent: SentFrame[] = []
  const ws = {
    send: (message: string | Buffer) => {
      if (typeof message === 'string') sent.push(JSON.parse(message))
    }
  } as unknown as WebSocketRoute
  const execution = new ExecutionHelper({} as unknown as ComfyPage, ws)
  return { sent, simulator: new BackendSimulator(execution), execution }
}

/** The positions a workflow's frames occupy in the order they were sent. */
function positionsOf(sent: SentFrame[], workflowId: string): number[] {
  return sent.flatMap((frame, index) =>
    frame.data.workflow_id === workflowId ? [index] : []
  )
}

describe('BackendSimulator frame scripting', () => {
  it('stamps each prompt with its own workflow id', () => {
    const { sent, simulator } = harness()
    const a = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const b = simulator.prompt('job-b', { workflowId: 'wf-b' })

    simulator.play([a.start(), b.start(), a.success(), b.success()])

    expect(
      sent.map((frame) => [
        frame.type,
        frame.data.prompt_id,
        frame.data.workflow_id
      ])
    ).toEqual([
      ['execution_start', 'job-a', 'wf-a'],
      ['execution_start', 'job-b', 'wf-b'],
      ['execution_success', 'job-a', 'wf-a'],
      ['execution_success', 'job-b', 'wf-b']
    ])
  })

  it('omits workflow_id for a prompt with no metadata (legacy backend)', () => {
    const { sent, simulator } = harness()
    const legacy = simulator.prompt('job-a')

    simulator.play([legacy.start(), legacy.progress('1', 1, 4)])

    expect(sent).toHaveLength(2)
    expect(sent.every((frame) => !('workflow_id' in frame.data))).toBe(true)
  })

  it('leaves the metadata scope clean after each frame', () => {
    const { sent, simulator } = harness()
    const scoped = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const legacy = simulator.prompt('job-b')

    simulator.play([scoped.start(), legacy.start()])

    expect(sent[0].data.workflow_id).toBe('wf-a')
    expect(sent[1].data).not.toHaveProperty('workflow_id')
  })

  it('never lets metadata overwrite a frame field', () => {
    const { sent, execution } = harness()
    // Core merges `{**workflow_metadata, **data}`, so a client cannot hijack a
    // frame's own routing fields by naming them in its metadata. Reversing the
    // spread order in `emit` turns this red.
    execution.withMetadata(
      { workflow_id: 'wf-a', prompt_id: 'spoofed', node: 'spoofed' },
      () => execution.executing('job-a', '7')
    )

    expect(sent[0].data).toEqual({
      workflow_id: 'wf-a',
      prompt_id: 'job-a',
      node: '7'
    })
  })

  it('does not stamp status frames, even inside an active scope', () => {
    const { sent, execution } = harness()

    execution.withWorkflowId('wf-a', () => {
      execution.executionStart('job-a')
      execution.status(2)
    })

    // The first frame proves the scope was live when `status` was sent, so the
    // second assertion is about the exemption and not about an empty scope.
    expect(sent[0].data.workflow_id).toBe('wf-a')
    expect(sent[1].type).toBe('status')
    expect(sent[1].data).not.toHaveProperty('workflow_id')
  })

  it('keeps the workflow id scope open across awaits', async () => {
    const { sent, execution } = harness()

    await execution.withWorkflowId('wf-a', async () => {
      execution.executionStart('job-a')
      await Promise.resolve()
      execution.executionSuccess('job-a')
    })
    execution.executionStart('job-b')

    expect(sent.map((frame) => frame.data.workflow_id)).toEqual([
      'wf-a',
      'wf-a',
      undefined
    ])
  })

  it('refuses a second scope while an async one is still in flight', async () => {
    const { execution } = harness()
    let release!: () => void
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })

    const scope = execution.withWorkflowId('wf-a', () => blocked)
    expect(() => execution.withWorkflowId('wf-b', () => {})).toThrow(
      /in flight/
    )

    release()
    await scope

    expect(() => execution.withWorkflowId('wf-b', () => {})).not.toThrow()
  })

  it('drops a frame the backend never sent', () => {
    const { sent, simulator } = harness()
    const prompt = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const script = [
      prompt.start(),
      prompt.progress('1', 1, 4),
      prompt.success()
    ]

    simulator.play(dropFrames(script, 'wf-a:execution_success'))

    expect(sent.map((frame) => frame.type)).toEqual([
      'execution_start',
      'progress'
    ])
  })

  it('drops one job of two prompts sharing a workflow id', () => {
    const { sent, simulator } = harness()
    const first = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const second = simulator.prompt('job-b', { workflowId: 'wf-a' })
    const script = [
      first.start(),
      second.start(),
      first.success(),
      second.success()
    ]

    simulator.play(
      dropFrames(script, {
        label: 'wf-a:execution_success',
        jobId: 'job-a'
      })
    )

    expect(sent.map((frame) => [frame.type, frame.data.prompt_id])).toEqual([
      ['execution_start', 'job-a'],
      ['execution_start', 'job-b'],
      ['execution_success', 'job-b']
    ])
  })

  it('duplicates a frame', () => {
    const { sent, simulator } = harness()
    const prompt = simulator.prompt('job-a', { workflowId: 'wf-a' })

    simulator.play(
      duplicateFrame(
        [prompt.start(), prompt.success()],
        'wf-a:execution_success'
      )
    )

    expect(sent.map((frame) => frame.type)).toEqual([
      'execution_start',
      'execution_success',
      'execution_success'
    ])
  })

  it('duplicates one job of two prompts sharing a workflow id', () => {
    const { sent, simulator } = harness()
    const first = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const second = simulator.prompt('job-b', { workflowId: 'wf-a' })

    simulator.play(
      duplicateFrame([first.success(), second.success()], {
        label: 'wf-a:execution_success',
        jobId: 'job-b'
      })
    )

    expect(sent.map((frame) => frame.data.prompt_id)).toEqual([
      'job-a',
      'job-b',
      'job-b'
    ])
  })

  it('swaps two frames to produce out-of-order arrival', () => {
    const { sent, simulator } = harness()
    const prompt = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const script = [prompt.start(), prompt.executed('1', {}), prompt.success()]

    simulator.play(
      swapFrames(script, 'wf-a:executed', 'wf-a:execution_success')
    )

    expect(sent.map((frame) => frame.type)).toEqual([
      'execution_start',
      'execution_success',
      'executed'
    ])
  })

  it('swaps one job of two prompts sharing a workflow id', () => {
    const { sent, simulator } = harness()
    const first = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const second = simulator.prompt('job-b', { workflowId: 'wf-a' })
    const script = [
      first.start(),
      second.start(),
      first.success(),
      second.success()
    ]

    // job-a terminates before job-b is even announced.
    simulator.play(
      swapFrames(
        script,
        { label: 'wf-a:execution_start', jobId: 'job-b' },
        { label: 'wf-a:execution_success', jobId: 'job-a' }
      )
    )

    expect(sent.map((frame) => [frame.type, frame.data.prompt_id])).toEqual([
      ['execution_start', 'job-a'],
      ['execution_success', 'job-a'],
      ['execution_start', 'job-b'],
      ['execution_success', 'job-b']
    ])
  })

  it('throws rather than silently skipping an unknown swap target', () => {
    const { simulator } = harness()
    const prompt = simulator.prompt('job-a', { workflowId: 'wf-a' })

    expect(() =>
      swapFrames([prompt.start()], 'wf-a:execution_start', 'wf-a:nope')
    ).toThrow(/not in the script/)
  })

  it('throws rather than swapping an ambiguously selected frame', () => {
    const { simulator } = harness()
    const first = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const second = simulator.prompt('job-b', { workflowId: 'wf-a' })

    expect(() =>
      swapFrames(
        [first.start(), second.start(), first.success()],
        'wf-a:execution_start',
        'wf-a:execution_success'
      )
    ).toThrow(/matches 2 frames/)
  })

  it('throws rather than swapping a frame with itself', () => {
    const { simulator } = harness()
    const prompt = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const script = [prompt.start(), prompt.success()]

    // Both selectors resolve, each unambiguously, and the swap is still a
    // no-op — the same silent no-fault `requireMatches` rules out.
    expect(() =>
      swapFrames(script, 'wf-a:execution_start', 'wf-a:execution_start')
    ).toThrow(/same frame/)
  })

  it('throws rather than silently applying no fault at all', () => {
    const { simulator } = harness()
    const prompt = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const script = [prompt.start()]

    expect(() => dropFrames(script, 'wf-a:execution_success')).toThrow(
      /not in the script/
    )
    expect(() =>
      duplicateFrame(script, {
        label: 'wf-a:execution_start',
        jobId: 'job-zzz'
      })
    ).toThrow(/not in the script/)
  })
})

describe('BackendSimulator frame granularity', () => {
  /** Every frame builder on `SimulatedPrompt`, scripted once. */
  function everyFrame(simulator: BackendSimulator): Frame[] {
    const p = simulator.prompt('job-a', { workflowId: 'wf-a' })
    return [
      p.start(),
      p.executing('1'),
      p.progress('1', 1, 4),
      ...p.nodeRunning('1', 1, 4),
      p.executed('1', {}),
      p.success(),
      p.error('1', 'boom'),
      p.interrupted('1'),
      p.latentPreview('1')
    ]
  }

  it('sends exactly one WebSocket frame per scheduled Frame', () => {
    // The contract `Frame` documents, and the one a fault helper depends on: a
    // Frame that sent two messages would leave the second unreachable to every
    // selector and would make `interleave` schedule fewer units than it emits.
    // Counts raw sends, so the binary `latentPreview` is included.
    let sends = 0
    const ws = {
      send: () => {
        sends++
      }
    } as unknown as WebSocketRoute
    const execution = new ExecutionHelper({} as unknown as ComfyPage, ws)
    const simulator = new BackendSimulator(execution)
    const script = everyFrame(simulator)

    simulator.play(script)

    expect(sends).toBe(script.length)
  })

  it('gives a frame builder a label matching the event it sends', () => {
    const { sent, simulator } = harness()
    const script = everyFrame(simulator)

    simulator.play(script)

    // `latentPreview` is binary and never reaches the JSON stub, so compare the
    // JSON frames against the labels of the Frames that produce them.
    expect(sent.map((frame) => frame.type)).toEqual(
      script.slice(0, -1).map((frame) => frame.label.split(':')[1])
    )
  })

  it('scripts the two halves of a running node independently', () => {
    const { sent, simulator } = harness()
    const prompt = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const script = [prompt.start(), ...prompt.nodeRunning('1', 1, 4)]

    // A backend that reported the state change but never the step count is one
    // of the shapes behind progress stuck after a run; it needs the `progress`
    // half to be individually droppable.
    simulator.play(dropFrames(script, 'wf-a:progress'))

    expect(sent.map((frame) => frame.type)).toEqual([
      'execution_start',
      'progress_state'
    ])
  })
})

describe('BackendSimulator interleaving', () => {
  function twoPrompts(seed: number) {
    const h = harness()
    const a = h.simulator.prompt('job-a', { workflowId: 'wf-a' })
    const b = h.simulator.prompt('job-b', { workflowId: 'wf-b' })
    h.simulator.play(
      interleave(
        [a.start(), a.progress('1', 1, 4), a.success()],
        [b.start(), b.progress('2', 1, 4), b.success()],
        seed
      )
    )
    return h.sent
  }

  it('produces the documented overlapping order for seed 7', () => {
    expect(
      twoPrompts(7).map((frame) => `${frame.data.workflow_id}:${frame.type}`)
    ).toEqual([
      'wf-a:execution_start',
      'wf-a:progress',
      'wf-b:execution_start',
      'wf-a:execution_success',
      'wf-b:progress',
      'wf-b:execution_success'
    ])
  })

  it.for(SEEDS)('keeps both prompts in flight at once for seed %i', (seed) => {
    const sent = twoPrompts(seed)
    const a = positionsOf(sent, 'wf-a')
    const b = positionsOf(sent, 'wf-b')

    // The two runs' spans intersect: neither prompt's script finishes before
    // the other's starts. Without this the schedule is sequential and a
    // concurrency spec can pass having never had two prompts in flight.
    expect(a[0]).toBeLessThan(b[b.length - 1])
    expect(b[0]).toBeLessThan(a[a.length - 1])
  })

  it.for(SEEDS)(
    "preserves each prompt's own dependency order for seed %i",
    (seed) => {
      const sent = twoPrompts(seed)
      const typesOf = (workflowId: string) =>
        sent
          .filter((frame) => frame.data.workflow_id === workflowId)
          .map((frame) => frame.type)

      expect(typesOf('wf-a')).toEqual([
        'execution_start',
        'progress',
        'execution_success'
      ])
      expect(typesOf('wf-b')).toEqual([
        'execution_start',
        'progress',
        'execution_success'
      ])
    }
  )

  it('interleaves deterministically for a given seed', () => {
    const first = twoPrompts(7).map((frame) => frame.data.workflow_id)
    const second = twoPrompts(7).map((frame) => frame.data.workflow_id)

    expect(second).toEqual(first)
    expect(first).toHaveLength(6)
  })

  it('gives different seeds different schedules', () => {
    const schedules = new Set(
      SEEDS.map((seed) =>
        twoPrompts(seed)
          .map((frame) => frame.data.workflow_id)
          .join(',')
      )
    )

    // `seed` has to name a schedule, so near-distinct is the bar: these seven
    // seeds produce six distinct orders. A coin that merely alternates — LCG
    // bit 0, which flips every step whatever the seed — collapses them to two
    // (`ababab` and `bababa`) and still passes a `> 1` check. The exact-32-bit
    // multiply is pinned separately by the seed 7 order above; this assertion
    // is about the coin, not the arithmetic.
    expect(schedules.size).toBeGreaterThanOrEqual(5)
  })

  it('keeps every frame exactly once when interleaving', () => {
    const { sent, simulator } = harness()
    const a = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const b = simulator.prompt('job-b', { workflowId: 'wf-b' })

    simulator.play(
      interleave([a.start(), a.success()], [b.start(), b.success()], 42)
    )

    expect(positionsOf(sent, 'wf-a')).toHaveLength(2)
    expect(positionsOf(sent, 'wf-b')).toHaveLength(2)
  })
})
