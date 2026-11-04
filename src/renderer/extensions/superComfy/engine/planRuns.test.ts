import { assert, describe, expect, it } from 'vitest'

import {
  docWith,
  edge,
  fileItem,
  generateNode,
  ioNode,
  port,
  withLastResult
} from './engineFixtures'
import { textItem } from './items'
import { planRuns } from './planRuns'

const limits = { runLimit: 50 }

describe(planRuns, () => {
  it('[R1a] fans a 3-item batch from one node into a single-item input as 3 runs, one item each, in order', () => {
    const doc = docWith(
      [
        ioNode('images', 'image', [
          fileItem('a1'),
          fileItem('a2'),
          fileItem('a3')
        ]),
        generateNode('gen', 'image', {
          inputs: [port('image', 'image', { required: true })]
        })
      ],
      [edge('images', 'out', 'gen', 'image')]
    )

    expect(planRuns(doc, 'gen', limits)).toMatchObject({
      ok: true,
      runs: [
        { index: 0, inputs: { image: [fileItem('a1')] } },
        { index: 1, inputs: { image: [fileItem('a2')] } },
        { index: 2, inputs: { image: [fileItem('a3')] } }
      ]
    })
  })

  it('[R1b] makes every combination when two batched inputs meet: 3 images × 2 prompts = 6 distinct runs', () => {
    const doc = docWith(
      [
        ioNode('images', 'image', [
          fileItem('a1'),
          fileItem('a2'),
          fileItem('a3')
        ]),
        ioNode('prompts', 'text', [textItem('p1'), textItem('p2')]),
        generateNode('gen', 'image', {
          inputs: [
            port('image', 'image', { required: true }),
            port('prompt', 'text', { required: true })
          ]
        })
      ],
      [
        edge('images', 'out', 'gen', 'image'),
        edge('prompts', 'out', 'gen', 'prompt')
      ]
    )

    const plan = planRuns(doc, 'gen', limits)

    assert(plan.ok)
    expect(plan.runs.map(({ inputs }) => inputs)).toEqual([
      { image: [fileItem('a1')], prompt: [textItem('p1')] },
      { image: [fileItem('a1')], prompt: [textItem('p2')] },
      { image: [fileItem('a2')], prompt: [textItem('p1')] },
      { image: [fileItem('a2')], prompt: [textItem('p2')] },
      { image: [fileItem('a3')], prompt: [textItem('p1')] },
      { image: [fileItem('a3')], prompt: [textItem('p2')] }
    ])
    expect(new Set(plan.runs.map(({ key }) => key)).size).toBe(6)
  })

  it('[R1c] fills a multi-item input from two separate single-item nodes in one run', () => {
    const doc = docWith(
      [
        ioNode('first', 'image', [fileItem('a')]),
        ioNode('second', 'image', [fileItem('b')]),
        generateNode('gen', 'image', {
          inputs: [port('refs', 'image', { multi: true, required: true })]
        })
      ],
      [
        edge('first', 'out', 'gen', 'refs'),
        edge('second', 'out', 'gen', 'refs')
      ]
    )

    expect(planRuns(doc, 'gen', limits)).toMatchObject({
      ok: true,
      runs: [{ index: 0, inputs: { refs: [fileItem('a'), fileItem('b')] } }]
    })
  })

  it('[R1d] still fans out a 3-item batch from one node into a multi-item input', () => {
    const doc = docWith(
      [
        ioNode('batch', 'image', [
          fileItem('a1'),
          fileItem('a2'),
          fileItem('a3')
        ]),
        generateNode('gen', 'image', {
          inputs: [port('refs', 'image', { multi: true, required: true })]
        })
      ],
      [edge('batch', 'out', 'gen', 'refs')]
    )

    expect(planRuns(doc, 'gen', limits)).toMatchObject({
      ok: true,
      runs: [
        { inputs: { refs: [fileItem('a1')] } },
        { inputs: { refs: [fileItem('a2')] } },
        { inputs: { refs: [fileItem('a3')] } }
      ]
    })
  })

  it('[R1e] multiplies runs by the run count, repeats grouped per input: 3 items × 3 = 9 distinct keys', () => {
    const doc = docWith(
      [
        ioNode('images', 'image', [
          fileItem('a1'),
          fileItem('a2'),
          fileItem('a3')
        ]),
        generateNode('gen', 'image', {
          inputs: [port('image', 'image', { required: true })],
          runCount: 3
        })
      ],
      [edge('images', 'out', 'gen', 'image')]
    )

    const plan = planRuns(doc, 'gen', limits)

    assert(plan.ok)
    expect(
      plan.runs.map(({ inputs, repeat }) => [inputs.image, repeat])
    ).toEqual([
      [[fileItem('a1')], 0],
      [[fileItem('a1')], 1],
      [[fileItem('a1')], 2],
      [[fileItem('a2')], 0],
      [[fileItem('a2')], 1],
      [[fileItem('a2')], 2],
      [[fileItem('a3')], 0],
      [[fileItem('a3')], 1],
      [[fileItem('a3')], 2]
    ])
    expect(new Set(plan.runs.map(({ key }) => key)).size).toBe(9)
  })

  it('composes fixed items, batches and the run count: the worked example plans 12 runs', () => {
    const doc = docWith(
      [
        ioNode('single', 'image', [fileItem('a')]),
        ioNode('batch', 'image', [
          fileItem('b1'),
          fileItem('b2'),
          fileItem('b3')
        ]),
        ioNode('prompts', 'text', [textItem('p1'), textItem('p2')]),
        generateNode('gen', 'image', {
          inputs: [
            port('refs', 'image', { multi: true, required: true }),
            port('prompt', 'text', { required: true })
          ],
          runCount: 2
        })
      ],
      [
        edge('single', 'out', 'gen', 'refs'),
        edge('batch', 'out', 'gen', 'refs'),
        edge('prompts', 'out', 'gen', 'prompt')
      ]
    )

    const plan = planRuns(doc, 'gen', limits)

    assert(plan.ok)
    expect(plan.runs).toHaveLength(12)
    expect(plan.runs[0].inputs).toEqual({
      refs: [fileItem('a'), fileItem('b1')],
      prompt: [textItem('p1')]
    })
  })

  it('gives the same text entered twice in a batch two distinct runs', () => {
    const doc = docWith(
      [
        ioNode('prompts', 'text', [textItem('a cat'), textItem('a cat')]),
        generateNode('gen', 'image', {
          inputs: [port('prompt', 'text', { required: true })]
        })
      ],
      [edge('prompts', 'out', 'gen', 'prompt')]
    )

    const plan = planRuns(doc, 'gen', limits)

    assert(plan.ok)
    expect(new Set(plan.runs.map(({ key }) => key)).size).toBe(2)
  })

  it('[R3c] an executable feeding an executable directly passes the full output batch', () => {
    const doc = docWith(
      [
        withLastResult(generateNode('first', 'image'), [
          fileItem('o1'),
          fileItem('o2'),
          fileItem('o3')
        ]),
        generateNode('second', 'image', {
          inputs: [port('image', 'image', { required: true })]
        })
      ],
      [edge('first', 'out', 'second', 'image')]
    )

    expect(planRuns(doc, 'second', limits)).toMatchObject({
      ok: true,
      runs: [
        { inputs: { image: [fileItem('o1')] } },
        { inputs: { image: [fileItem('o2')] } },
        { inputs: { image: [fileItem('o3')] } }
      ]
    })
  })

  it("[R5c] an upstream executable node's last result counts as content", () => {
    const doc = docWith(
      [
        withLastResult(generateNode('writer', 'text'), [
          textItem('a lighthouse at dusk')
        ]),
        generateNode('painter', 'image', {
          inputs: [port('prompt', 'text', { required: true })]
        })
      ],
      [edge('writer', 'out', 'painter', 'prompt')]
    )

    expect(planRuns(doc, 'painter', limits)).toMatchObject({
      ok: true,
      runs: [{ inputs: { prompt: [textItem('a lighthouse at dusk')] } }]
    })
  })

  it.for([
    {
      name: 'an unwired port uses its inline text',
      edges: [],
      expected: {
        ok: true,
        runs: [{ inputs: { prompt: [textItem('a red fox')] } }]
      }
    },
    {
      name: 'a port wired to an empty node is missing',
      edges: [edge('notes', 'out', 'gen', 'prompt')],
      expected: {
        ok: false,
        block: { reason: 'missingInputs', ports: ['prompt'] }
      }
    }
  ])(
    '[R5d] inline text counts as content only while its port has no wire: $name',
    ({ edges, expected }) => {
      const doc = docWith(
        [
          ioNode('notes', 'text'),
          generateNode('gen', 'image', {
            inputs: [port('prompt', 'text', { required: true, inline: true })],
            inline: { prompt: 'a red fox' }
          })
        ],
        edges
      )

      expect(planRuns(doc, 'gen', limits)).toMatchObject(expected)
    }
  )
})
