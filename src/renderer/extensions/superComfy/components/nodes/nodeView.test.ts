import { describe, expect, it } from 'vitest'

import type {
  GenerateNode,
  RunFailure
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import {
  docWith,
  fileItem,
  generateNode,
  port
} from '@/renderer/extensions/superComfy/engine/engineFixtures'
import { plannedRunCount } from '@/renderer/extensions/superComfy/engine/selectors'
import type {
  NodeActivity,
  RunSlot
} from '@/renderer/extensions/superComfy/engine/types'

import {
  batchEntries,
  nodeStatus,
  resultCredits,
  resultNotices
} from './nodeView'
import type { StatusLine } from './nodeView'

const promptPort = port('prompt', 'text', {
  label: 'Prompt',
  required: true,
  inline: true
})

function promptNode(overrides: Partial<GenerateNode> = {}): GenerateNode {
  return {
    ...generateNode('gen', 'image', { inputs: [promptPort] }),
    ...overrides
  }
}

function slot(index: number, state: RunSlot['state'], extra = {}): RunSlot {
  return { key: `k${index}`, index, state, ...extra }
}

function withResult(
  planKeys: string[],
  failures: RunFailure[],
  status: 'complete' | 'partial' | 'failed'
): Partial<GenerateNode> {
  return {
    inline: { prompt: 'a lighthouse' },
    result: { planKeys, outputs: {}, failures, status, finishedAt: 1 }
  }
}

function statusOf(
  node: GenerateNode,
  activity: NodeActivity,
  missing: string[] = [],
  error?: string
) {
  return nodeStatus({
    node,
    activity,
    plan: plannedRunCount(docWith([node]), node.id, 50),
    missing,
    error
  })
}

const idle: NodeActivity = { phase: 'idle' }

interface StatusCase {
  name: string
  node: GenerateNode
  activity: NodeActivity
  missing: string[]
  expected: StatusLine
}

describe('nodeStatus', () => {
  it('leaves a Generate node without a model to its model picker', () => {
    const unpicked = promptNode({
      modelId: null,
      modelLabel: null,
      contract: null
    })

    expect(statusOf(unpicked, idle)).toBeNull()
  })

  it.for<StatusCase>([
    {
      name: 'names an empty required input before any run, quietly',
      node: promptNode(),
      activity: idle,
      missing: [],
      expected: {
        tone: 'muted',
        key: 'superComfy.node.needs',
        params: { port: 'Prompt' }
      }
    },
    {
      name: 'marks the empty input after a refused run',
      node: promptNode(),
      activity: {
        phase: 'blocked',
        sessionId: null,
        block: { reason: 'missingInputs', ports: ['prompt'] }
      },
      missing: ['prompt'],
      expected: {
        tone: 'destructive',
        key: 'superComfy.node.needs',
        params: { port: 'Prompt' }
      }
    },
    {
      name: 'counts settled runs while running',
      node: promptNode(),
      activity: {
        phase: 'running',
        sessionId: 's',
        slots: [
          ...[0, 1, 2].map((index) => slot(index, 'done')),
          slot(3, 'failed'),
          slot(4, 'running'),
          ...[5, 6, 7, 8].map((index) => slot(index, 'queued'))
        ]
      },
      missing: [],
      expected: {
        tone: 'muted',
        key: 'superComfy.node.running',
        params: { done: 4, total: 9 }
      }
    },
    {
      name: 'shows the best queue position while every run waits in a queue',
      node: promptNode(),
      activity: {
        phase: 'running',
        sessionId: 's',
        slots: [
          slot(0, 'running', { queuePosition: 5 }),
          slot(1, 'running', { queuePosition: 3 })
        ]
      },
      missing: [],
      expected: {
        tone: 'muted',
        key: 'superComfy.node.queued',
        params: { position: 3 }
      }
    },
    {
      name: 'reports failed runs after a partial result',
      node: promptNode(
        withResult(
          ['a', 'b', 'c'],
          [
            { key: 'b', index: 1, message: 'Out of credits' },
            { key: 'c', index: 2, code: 'noOutput' }
          ],
          'partial'
        )
      ),
      activity: idle,
      missing: [],
      expected: {
        tone: 'destructive',
        key: 'superComfy.node.failed',
        params: { count: 2 }
      }
    },
    {
      name: 'says when a finished node no longer matches its inputs',
      node: promptNode(withResult(['old-key'], [], 'complete')),
      activity: idle,
      missing: [],
      expected: { tone: 'muted', key: 'superComfy.node.changed' }
    }
  ])('$name', ({ node, activity, missing, expected }) => {
    expect(statusOf(node, activity, missing)).toEqual(expected)
  })

  it('shows a node error exactly as received', () => {
    expect(
      statusOf(promptNode(), idle, [], 'App not found: portrait.app.json')
    ).toEqual({ tone: 'destructive', text: 'App not found: portrait.app.json' })
  })
})

describe('batchEntries', () => {
  it('puts a failed tile at the index of the run that failed', () => {
    const node = promptNode({
      runs: {
        a: {
          key: 'a',
          index: 0,
          outputs: { out: [fileItem('a.png')] },
          finishedAt: 1
        },
        c: {
          key: 'c',
          index: 2,
          outputs: { out: [fileItem('c.png')] },
          finishedAt: 1
        }
      },
      result: {
        planKeys: ['a', 'b', 'c'],
        outputs: { out: [fileItem('a.png'), fileItem('c.png')] },
        failures: [{ key: 'b', index: 1, message: 'Out of credits' }],
        status: 'partial',
        finishedAt: 1
      }
    })

    expect(batchEntries(node, 'out')).toEqual([
      { kind: 'item', item: fileItem('a.png') },
      { kind: 'failed', message: 'Out of credits', code: undefined },
      { kind: 'item', item: fileItem('c.png') }
    ])
  })
})

describe('resultCredits', () => {
  it('adds up the credits the server reported for the last result', () => {
    const node = promptNode({
      runs: {
        a: { key: 'a', index: 0, outputs: {}, finishedAt: 1, creditsUsed: 1.5 },
        b: { key: 'b', index: 1, outputs: {}, finishedAt: 1 },
        stale: {
          key: 'stale',
          index: 0,
          outputs: {},
          finishedAt: 1,
          creditsUsed: 9
        }
      },
      result: {
        planKeys: ['a', 'b'],
        outputs: {},
        failures: [],
        status: 'complete',
        finishedAt: 1
      }
    })

    expect(resultCredits(node)).toBe(1.5)
  })
})

describe('resultNotices', () => {
  it('lists each notice from the last result once, skipping older runs', () => {
    const notice = 'Comfy Router ignored: seed'
    const node = promptNode({
      runs: {
        a: { key: 'a', index: 0, outputs: {}, finishedAt: 1, notice },
        b: { key: 'b', index: 1, outputs: {}, finishedAt: 1, notice },
        c: { key: 'c', index: 2, outputs: {}, finishedAt: 1 },
        stale: {
          key: 'stale',
          index: 0,
          outputs: {},
          finishedAt: 1,
          notice: 'Comfy Router ignored: style'
        }
      },
      result: {
        planKeys: ['a', 'b', 'c'],
        outputs: {},
        failures: [],
        status: 'complete',
        finishedAt: 1
      }
    })

    expect(resultNotices(node)).toEqual([notice])
  })
})
