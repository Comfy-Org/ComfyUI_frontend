import fs from 'node:fs'
import path from 'node:path'
import { assert, describe, expect, it } from 'vitest'

import { onGraphIntent } from '@/lib/litegraph/src/graphIntents'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { WorkflowJSON04 } from '@comfyorg/graph-model/workflowSchema'

import {
  convertRerouteNodes,
  planRerouteNodeConversion
} from './rerouteNodeConversion'
import type { RerouteNodeSkipReason } from './rerouteNodeConversion'

type Workflow = WorkflowJSON04
type Node = Workflow['nodes'][number]
type Point = [number, number]

function readFixture(name: string): Workflow {
  return JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../utils/migration/__fixtures__/reroute/legacy',
        name
      ),
      'utf-8'
    )
  )
}

function loadGraph(workflow: Workflow) {
  const graph = new LGraph()
  graph.configure(JSON.parse(JSON.stringify(workflow)))
  return graph
}

function serialize(graph: LGraph): Workflow {
  return JSON.parse(JSON.stringify(graph.serialize()))
}

function convertAll(graph: LGraph) {
  const plan = planRerouteNodeConversion(graph, graph.nodes)
  return { plan, converted: convertRerouteNodes(graph, plan.convertible) }
}

function nodeById(workflow: Workflow, id: unknown): Node | undefined {
  return workflow.nodes.find((node) => String(node.id) === String(id))
}

function linkById(workflow: Workflow, id: unknown) {
  return workflow.links.find(([linkId]) => String(linkId) === String(id))
}

function center(node: Node): Point {
  const [x, y] = node.pos
  const [w, h] = node.size
  return [x + w / 2, y + h / 2]
}

function sourcesByTarget(workflow: Workflow) {
  const sources: Record<string, string> = {}
  for (const [, originId, originSlot, targetId, targetSlot] of workflow.links) {
    if (nodeById(workflow, targetId)?.type === 'Reroute') continue
    let origin = { id: originId, slot: originSlot }
    while (nodeById(workflow, origin.id)?.type === 'Reroute') {
      const upstream = linkById(
        workflow,
        nodeById(workflow, origin.id)?.inputs?.[0]?.link
      )
      if (!upstream) break
      origin = { id: upstream[1], slot: upstream[2] }
    }
    sources[`${targetId}:${targetSlot}`] = `${origin.id}:${origin.slot}`
  }
  return sources
}

function rerouteChain(workflow: Workflow, linkId: number): Point[] {
  const reroutes = workflow.extra?.reroutes ?? []
  const chain: Point[] = []
  let parentId = workflow.extra?.linkExtensions?.find(
    ({ id }) => id === linkId
  )?.parentId
  while (parentId !== undefined) {
    const reroute = reroutes.find(({ id }) => id === parentId)
    if (!reroute) break
    chain.unshift(reroute.pos)
    parentId = reroute.parentId
  }
  return chain
}

interface TestNode {
  id: number
  type?: string
  mode?: number
  inputs?: [type: string, link: number | null][]
  outputs?: [type: string, links: number[]][]
}

function workflowOf(
  nodes: TestNode[],
  links: [number, number, number, number, number, string][],
  extra: Workflow['extra'] = {}
): Workflow {
  return {
    last_node_id: 100,
    last_link_id: 100,
    nodes: nodes.map(
      ({ id, type = 'Test', mode = 0, inputs = [], outputs = [] }) => ({
        id,
        type,
        pos: [id * 100, 0],
        size: [80, 30],
        flags: {},
        order: id,
        mode,
        properties: {},
        inputs: inputs.map(([type, link], index) => ({
          name: `in${index}`,
          type,
          link
        })),
        outputs: outputs.map(([type, links], index) => ({
          name: `out${index}`,
          type,
          links
        }))
      })
    ),
    links,
    groups: [],
    config: {},
    extra,
    version: 0.4
  }
}

describe('Reroute node conversion', () => {
  it.for([
    { name: 'single_connected.json', converted: 1, skipped: [] },
    { name: 'branching.json', converted: 3, skipped: [] },
    {
      name: 'floating_branch.json',
      converted: 2,
      skipped: [{ id: 34, reason: 'noOutput' }]
    },
    {
      name: 'floating.json',
      converted: 0,
      skipped: [
        { id: 13, reason: 'noInput' },
        { id: 25, reason: 'noOutput' },
        { id: 28, reason: 'noOutput' },
        { id: 30, reason: 'noOutput' },
        { id: 29, reason: 'noOutput' },
        { id: 31, reason: 'noInput' }
      ]
    }
  ])(
    'keeps every connection of $name and round-trips the result',
    ({ name, converted, skipped }) => {
      const before = readFixture(name)
      const graph = loadGraph(before)

      const result = convertAll(graph)
      const after = serialize(graph)

      expect(result.converted).toBe(converted)
      expect(
        result.plan.skipped.map(({ node, reason }) => ({
          id: Number(node.id),
          reason
        }))
      ).toEqual(skipped)
      expect(sourcesByTarget(after)).toEqual(sourcesByTarget(before))
      const remaining = after.nodes
        .filter((node) => node.type === 'Reroute')
        .map((node) => Number(node.id))
      expect(remaining).toEqual(
        expect.arrayContaining(skipped.map(({ id }) => id))
      )
      expect(remaining).toHaveLength(skipped.length)
      expect({ ...serialize(loadGraph(after)), id: after.id }).toEqual(after)
    }
  )

  it('places link reroutes at the converted node centres in chain order', () => {
    const before = readFixture('branching.json')
    const graph = loadGraph(before)

    convertAll(graph)

    const reroute = (id: number) => center(nodeById(before, id)!)
    const after = serialize(graph)
    expect(rerouteChain(after, 21)).toEqual([reroute(25), reroute(13)])
    expect(rerouteChain(after, 34)).toEqual([reroute(25), reroute(27)])
  })

  it('announces the spliced connection so a bound document follows it', () => {
    const graph = loadGraph(readFixture('single_connected.json'))
    const intents: unknown[] = []
    const stop = onGraphIntent((intent) => {
      if (intent.type === 'connect' || intent.type === 'disconnect')
        intents.push([
          intent.type,
          intent.link.id,
          intent.link.origin_id,
          intent.link.target_id
        ])
      else if (intent.type === 'remove_node')
        intents.push([intent.type, intent.node.id])
    })

    try {
      convertAll(graph)
    } finally {
      stop()
    }

    expect(intents).toEqual([
      ['disconnect', 21, '4', '12'],
      ['connect', 21, '4', '12'],
      ['disconnect', 13, '4', '13'],
      ['remove_node', '13']
    ])
  })

  it('leaves a Reroute node that refuses removal untouched', () => {
    const graph = loadGraph(readFixture('single_connected.json'))
    const reroute = graph.nodes.find((node) => node.type === 'Reroute')
    assert(reroute)
    reroute.ignore_remove = true
    const before = serialize(graph)

    const { plan, converted } = convertAll(graph)

    expect(converted).toBe(0)
    expect(plan.skipped.map((skip) => skip.reason)).toEqual(['locked'])
    expect(serialize(graph)).toEqual(before)
  })

  it('splices the converted reroute between existing link reroutes', () => {
    const upstream: Point = [150, 200]
    const downstream: Point = [350, 200]
    const graph = loadGraph(
      workflowOf(
        [
          { id: 1, outputs: [['IMAGE', [1]]] },
          { id: 2, type: 'Reroute', inputs: [['*', 1]], outputs: [['*', [2]]] },
          { id: 3, inputs: [['IMAGE', 2]] }
        ],
        [
          [1, 1, 0, 2, 0, '*'],
          [2, 2, 0, 3, 0, 'IMAGE']
        ],
        {
          reroutes: [
            { id: 1, pos: upstream, linkIds: [1] },
            { id: 2, pos: downstream, linkIds: [2] }
          ],
          linkExtensions: [
            { id: 1, parentId: 1 },
            { id: 2, parentId: 2 }
          ]
        }
      )
    )

    expect(convertAll(graph).converted).toBe(1)

    const after = serialize(graph)
    expect(after.links).toEqual([[2, 1, 0, 3, 0, 'IMAGE']])
    expect(rerouteChain(after, 2)).toEqual([upstream, [240, 15], downstream])
  })

  it.for<{
    case: string
    reason: RerouteNodeSkipReason
    workflow: Workflow
  }>([
    {
      case: 'an incompatible downstream input',
      reason: 'typeMismatch',
      workflow: workflowOf(
        [
          { id: 1, outputs: [['INT', [1]]] },
          { id: 2, type: 'Reroute', inputs: [['*', 1]], outputs: [['*', [2]]] },
          { id: 3, inputs: [['STRING', 2]] }
        ],
        [
          [1, 1, 0, 2, 0, '*'],
          [2, 2, 0, 3, 0, 'STRING']
        ]
      )
    },
    {
      case: 'a bypassed reroute',
      reason: 'bypassed',
      workflow: workflowOf(
        [
          { id: 1, outputs: [['INT', [1]]] },
          {
            id: 2,
            type: 'Reroute',
            mode: 4,
            inputs: [['*', 1]],
            outputs: [['*', [2]]]
          },
          { id: 3, inputs: [['INT', 2]] }
        ],
        [
          [1, 1, 0, 2, 0, '*'],
          [2, 2, 0, 3, 0, 'INT']
        ]
      )
    },
    {
      case: 'reroutes that feed each other',
      reason: 'cycle',
      workflow: workflowOf(
        [
          { id: 1, type: 'Reroute', inputs: [['*', 2]], outputs: [['*', [1]]] },
          {
            id: 2,
            type: 'Reroute',
            inputs: [['*', 1]],
            outputs: [['*', [2, 3]]]
          },
          { id: 3, inputs: [['INT', 3]] }
        ],
        [
          [1, 1, 0, 2, 0, '*'],
          [2, 2, 0, 1, 0, '*'],
          [3, 2, 0, 3, 0, 'INT']
        ]
      )
    }
  ])('leaves the graph untouched for $case', ({ reason, workflow }) => {
    const graph = loadGraph(workflow)
    const before = serialize(graph)

    const { plan, converted } = convertAll(graph)

    expect(converted).toBe(0)
    expect(plan.skipped.map((skip) => skip.reason)).toContain(reason)
    expect(serialize(graph)).toEqual(before)
  })
})
