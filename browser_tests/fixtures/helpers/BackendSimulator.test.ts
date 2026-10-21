import type { WebSocketRoute } from '@playwright/test'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Frame } from '@e2e/fixtures/helpers/BackendSimulator'
import {
  BackendSimulator,
  dropFrames,
  duplicateFrames,
  interleave,
  swapFrames
} from '@e2e/fixtures/helpers/BackendSimulator'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'

interface SentFrame {
  type: string
  data: Record<string, unknown>
}

const OVERLAP_SEEDS = [0, 3]

function harness() {
  const sent: SentFrame[] = []
  const binary: Buffer[] = []
  const ws = fromPartial<WebSocketRoute>({
    send: (message: string | Buffer) => {
      if (typeof message === 'string') sent.push(JSON.parse(message))
      else binary.push(message)
    }
  })
  const execution = new ExecutionHelper(fromPartial<ComfyPage>({}), ws)
  return { sent, binary, simulator: new BackendSimulator(execution), execution }
}

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

    simulator.play([legacy.start(), ...legacy.nodeRunning('1', 1, 4)])

    expect(sent).toHaveLength(3)
    expect(sent.every((frame) => !('workflow_id' in frame.data))).toBe(true)
  })

  it('leaves the metadata scope clean after each frame', () => {
    const { sent, simulator, execution } = harness()
    const scoped = simulator.prompt('job-a', { workflowId: 'wf-a' })

    simulator.play([scoped.start()])
    // Straight through `execution`, outside any scope. Going through a second
    // prompt masked the defect, because that prompt opened its own scope and
    // set the metadata itself, so a scope that never restored still passed.
    execution.executionStart('job-b')

    expect(sent[0].data.workflow_id).toBe('wf-a')
    expect(sent[1].data).not.toHaveProperty('workflow_id')
  })

  it('never lets metadata overwrite a frame field', () => {
    const { sent, execution } = harness()
    execution.withMetadata(
      { workflow_id: 'wf-a', prompt_id: 'spoofed', node: 'spoofed' },
      () => execution.executing('job-a', '7')
    )

    expect(sent[0].data).toEqual({
      workflow_id: 'wf-a',
      prompt_id: 'job-a',
      node: '7',
      display_node: '7'
    })
  })

  it('does not stamp status frames, even inside an active scope', () => {
    const { sent, execution } = harness()

    execution.withWorkflowId('wf-a', () => {
      execution.executionStart('job-a')
      execution.status(2)
    })

    expect(sent[0].data.workflow_id).toBe('wf-a')
    expect(sent[1].type).toBe('status')
    expect(sent[1].data).not.toHaveProperty('workflow_id')
  })

  it('stamps validation errors and binary previews with workflow ownership', () => {
    const { sent, binary, execution } = harness()

    execution.withWorkflowId('wf-a', () => {
      execution.validationError('job-a', '1', {})
      execution.latentPreview('job-a', '1')
    })

    expect(sent[0].data.workflow_id).toBe('wf-a')
    const metadataLength = binary[0].readUInt32BE(4)
    const metadata = JSON.parse(
      binary[0].subarray(8, 8 + metadataLength).toString()
    )
    expect(metadata).toMatchObject({
      prompt_id: 'job-a',
      workflow_id: 'wf-a'
    })
  })

  it('duplicates a frame', () => {
    const { sent, simulator } = harness()
    const prompt = simulator.prompt('job-a', { workflowId: 'wf-a' })

    simulator.play(
      duplicateFrames(
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

  it.for([
    {
      name: 'an unknown swap target',
      makeCall: () => {
        const prompt = harness().simulator.prompt('job-a', {
          workflowId: 'wf-a'
        })
        return () =>
          swapFrames([prompt.start()], 'wf-a:execution_start', 'wf-a:nope')
      },
      message: /not in the script/
    },
    {
      name: 'an ambiguous swap target',
      makeCall: () => {
        const { simulator } = harness()
        const first = simulator.prompt('job-a', { workflowId: 'wf-a' })
        const second = simulator.prompt('job-b', { workflowId: 'wf-a' })
        return () =>
          swapFrames(
            [first.start(), second.start(), first.success()],
            'wf-a:execution_start',
            'wf-a:execution_success'
          )
      },
      message: /matches 2 frames/
    },
    {
      name: 'the same frame twice',
      makeCall: () => {
        const prompt = harness().simulator.prompt('job-a', {
          workflowId: 'wf-a'
        })
        const script = [prompt.start(), prompt.success()]
        return () =>
          swapFrames(script, 'wf-a:execution_start', 'wf-a:execution_start')
      },
      message: /same frame/
    },
    {
      name: 'an unknown drop target',
      makeCall: () => {
        const prompt = harness().simulator.prompt('job-a', {
          workflowId: 'wf-a'
        })
        return () => dropFrames([prompt.start()], 'wf-a:execution_success')
      },
      message: /not in the script/
    },
    {
      name: 'an unknown duplicate target',
      makeCall: () => {
        const prompt = harness().simulator.prompt('job-a', {
          workflowId: 'wf-a'
        })
        return () => duplicateFrames([prompt.start()], 'wf-a:progress')
      },
      message: /not in the script/
    }
  ])('throws for $name', ({ makeCall, message }) => {
    expect(makeCall()).toThrow(message)
  })
})

describe('BackendSimulator frame granularity', () => {
  function everyFrame(simulator: BackendSimulator): Frame[] {
    const p = simulator.prompt('job-a', { workflowId: 'wf-a' })
    return [
      p.start(),
      p.executing('1'),
      ...p.nodeRunning('1', 1, 4),
      p.executed('1', {}),
      p.success(),
      p.latentPreview('1')
    ]
  }

  it('sends exactly one WebSocket frame per scheduled Frame', () => {
    let sends = 0
    const ws = fromPartial<WebSocketRoute>({
      send: () => {
        sends++
      }
    })
    const execution = new ExecutionHelper(fromPartial<ComfyPage>({}), ws)
    const simulator = new BackendSimulator(execution)
    const script = everyFrame(simulator)

    simulator.play(script)

    expect(sends).toBe(script.length)
  })

  it('gives a frame builder a label matching the event it sends', () => {
    const { sent, simulator } = harness()
    const script = everyFrame(simulator)

    simulator.play(script)

    expect(sent.map((frame) => frame.type)).toEqual(
      script.slice(0, -1).map((frame) => frame.label.split(':')[1])
    )
  })

  it('labels the binary frame with the event it dispatches', () => {
    const { simulator } = harness()
    const script = everyFrame(simulator)

    expect(script.at(-1)?.label).toBe('wf-a:b_preview_with_metadata')
  })

  it('scripts the two halves of a running node independently', () => {
    const { sent, simulator } = harness()
    const prompt = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const script = [prompt.start(), ...prompt.nodeRunning('1', 1, 4)]

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
        [a.start(), a.executed('1', {}), a.success()],
        [b.start(), b.executed('2', {}), b.success()],
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
      'wf-a:executed',
      'wf-b:execution_start',
      'wf-a:execution_success',
      'wf-b:executed',
      'wf-b:execution_success'
    ])
  })

  it.for(OVERLAP_SEEDS)(
    'keeps both prompts in flight at once for seed %i',
    (seed) => {
      const sent = twoPrompts(seed)
      const a = positionsOf(sent, 'wf-a')
      const b = positionsOf(sent, 'wf-b')

      expect(a[0]).toBeLessThan(b[b.length - 1])
      expect(b[0]).toBeLessThan(a[a.length - 1])
    }
  )

  it.for(OVERLAP_SEEDS)(
    "preserves each prompt's own dependency order for seed %i",
    (seed) => {
      const sent = twoPrompts(seed)
      function typesOf(workflowId: string) {
        return sent
          .filter((frame) => frame.data.workflow_id === workflowId)
          .map((frame) => frame.type)
      }

      expect(typesOf('wf-a')).toEqual([
        'execution_start',
        'executed',
        'execution_success'
      ])
      expect(typesOf('wf-b')).toEqual([
        'execution_start',
        'executed',
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
      OVERLAP_SEEDS.map((seed) =>
        twoPrompts(seed)
          .map((frame) => frame.data.workflow_id)
          .join(',')
      )
    )

    expect(schedules.size).toBe(2)
  })

  it('throws rather than returning a schedule that cannot overlap', () => {
    const { simulator } = harness()
    const a = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const script = [a.start(), a.success()]

    expect(() => interleave(script, [], 7)).toThrow(/both sides/)
    expect(() => interleave([], script, 7)).toThrow(/both sides/)
    expect(() => interleave([script[0]], [script[1]], 7)).toThrow(
      /at least three/
    )
  })

  it.for([11.9, 2 ** 32 + 11])('rejects unsupported seed %s', (seed) => {
    const { simulator } = harness()
    const a = simulator.prompt('job-a', { workflowId: 'wf-a' })
    const b = simulator.prompt('job-b', { workflowId: 'wf-b' })

    expect(() =>
      interleave([a.start(), a.success()], [b.start()], seed)
    ).toThrow(/signed 32-bit integer/)
  })
})
