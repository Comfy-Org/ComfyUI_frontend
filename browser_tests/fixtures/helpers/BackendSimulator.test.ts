import type { WebSocketRoute } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
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

    expect(sent.every((frame) => !('workflow_id' in frame.data))).toBe(true)
  })

  it('leaves the metadata scope clean after each frame', () => {
    const { sent, simulator } = harness()
    const scoped = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const legacy = simulator.prompt('job-b')

    simulator.play([scoped.start(), legacy.start()])

    expect(sent[1].data.workflow_id).toBeUndefined()
  })

  it('never lets metadata overwrite a frame field', () => {
    const { sent, simulator } = harness()
    // `workflow_id` is spread first, exactly as core does, so a real field wins.
    const prompt = simulator.prompt('job-a', { workflowId: 'wf-a' })

    simulator.play([prompt.executing('7')])

    expect(sent[0].data).toMatchObject({
      prompt_id: 'job-a',
      node: '7',
      workflow_id: 'wf-a'
    })
  })

  it('does not stamp status frames', () => {
    const { sent, simulator, execution } = harness()
    const prompt = simulator.prompt('job-a', { workflowId: 'wf-a' })

    simulator.play([prompt.start()])
    execution.status(0)

    expect(sent[1].type).toBe('status')
    expect(sent[1].data.workflow_id).toBeUndefined()
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

  it('throws rather than silently skipping an unknown swap target', () => {
    const { simulator } = harness()
    const prompt = simulator.prompt('job-a', { workflowId: 'wf-a' })

    expect(() =>
      swapFrames([prompt.start()], 'wf-a:execution_start', 'wf-a:nope')
    ).toThrow(/not in the script/)
  })

  it('interleaves deterministically for a given seed', () => {
    const { sent, simulator } = harness()
    const a = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const b = simulator.prompt('job-b', { workflowId: 'wf-b' })
    const script = interleave(
      [a.start(), a.progress('1', 1, 4), a.success()],
      [b.start(), b.progress('2', 1, 4), b.success()],
      7
    )

    simulator.play(script)
    const firstRun = sent.map((frame) => frame.data.workflow_id)

    const second = harness()
    const a2 = second.simulator.prompt('job-a', { workflowId: 'wf-a' })
    const b2 = second.simulator.prompt('job-b', { workflowId: 'wf-b' })
    second.simulator.play(
      interleave(
        [a2.start(), a2.progress('1', 1, 4), a2.success()],
        [b2.start(), b2.progress('2', 1, 4), b2.success()],
        7
      )
    )

    expect(second.sent.map((frame) => frame.data.workflow_id)).toEqual(firstRun)
    expect(firstRun).toHaveLength(6)
  })

  it('keeps every frame exactly once when interleaving', () => {
    const { sent, simulator } = harness()
    const a = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const b = simulator.prompt('job-b', { workflowId: 'wf-b' })

    simulator.play(
      interleave([a.start(), a.success()], [b.start(), b.success()], 42)
    )

    expect(
      sent.filter((frame) => frame.data.workflow_id === 'wf-a')
    ).toHaveLength(2)
    expect(
      sent.filter((frame) => frame.data.workflow_id === 'wf-b')
    ).toHaveLength(2)
  })
})
