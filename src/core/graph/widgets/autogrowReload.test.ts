import { assert, beforeEach, describe, expect, test, vi } from 'vitest'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ISerialisedGraph,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import type {
  ComfyNodeDef as ComfyNodeDefV1,
  InputSpec
} from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import { app } from '@/scripts/app'
import { toNodeId } from '@/types/nodeId'
import { reloadSerializedGraph } from '@/utils/__tests__/litegraphTestUtils'
import { growAutogrowInput } from './dynamicWidgets'

const TYPE = 'test/SeedanceRef'
const IMAGES = 'model.reference_images'
const VIDEOS = 'model.reference_videos'

function ag(
  inputType: string,
  key: string,
  names: string[],
  min = 0
): InputSpec {
  return [
    'COMFY_AUTOGROW_V3',
    {
      template: {
        input: { required: { [key]: [inputType, {}] } },
        names,
        min
      }
    }
  ]
}
function seq(p: string, n: number) {
  return Array.from({ length: n }, (_, i) => `${p}_${i + 1}`)
}
function image(i: number) {
  return `${IMAGES}.image_${i}`
}
function video(i: number) {
  return `${VIDEOS}.video_${i}`
}

const seedanceInputs = {
  required: {
    prompt: ['STRING', {}],
    resolution: [['480p', '720p'], {}],
    ratio: [['16:9', 'adaptive'], {}],
    duration: ['INT', { default: 5 }],
    generate_audio: ['BOOLEAN', { default: true }],
    reference_images: ag('IMAGE', 'reference_image', seq('image', 9)),
    reference_videos: ag('VIDEO', 'reference_video', seq('video', 3)),
    reference_audios: ag('AUDIO', 'reference_audio', seq('audio', 3))
  },
  optional: {
    auto_downscale: ['BOOLEAN', { default: true }],
    reference_assets: ag('STRING', 'reference_asset', seq('asset', 9))
  }
}
const def: ComfyNodeDefV1 = {
  name: TYPE,
  display_name: 'Seedance Ref',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      model: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            { key: 'Seedance 2.0', inputs: seedanceInputs },
            { key: 'Seedance 2.0 Fast', inputs: seedanceInputs }
          ]
        }
      ]
    }
  },
  output: ['VIDEO'],
  output_name: ['VIDEO'],
  output_node: false
}

function nonDefaultReferencesDef(referenceImages: InputSpec): ComfyNodeDefV1 {
  return {
    ...def,
    input: {
      required: {
        model: [
          'COMFY_DYNAMICCOMBO_V3',
          {
            options: [
              { key: 'without references', inputs: {} },
              {
                key: 'with references',
                inputs: {
                  required: {
                    reference_images: referenceImages,
                    reference_videos: ag('VIDEO', 'video', seq('video', 3))
                  }
                }
              }
            ]
          }
        ]
      }
    }
  }
}

const prefixImages: InputSpec = [
  'COMFY_AUTOGROW_V3',
  {
    template: {
      input: { required: { image: ['IMAGE', {}] } },
      prefix: 'image_',
      min: 0,
      max: 4
    }
  }
]

class Src extends LGraphNode {
  constructor() {
    super('Src')
    this.addOutput('image', 'IMAGE')
    this.addOutput('video', 'VIDEO')
  }
}

/** Connected inputs as `name<-originNodeId`, in slot order. */
function linked(n: LGraphNode) {
  return n.inputs.flatMap((inp, slot) => {
    const link = n.getInputLink(slot)
    return link ? [`${inp.name}<-${link.origin_id}`] : []
  })
}
function groupSlots(n: LGraphNode) {
  return n.inputs.flatMap(({ name }) =>
    name.startsWith(`${IMAGES}.`) || name.startsWith(`${VIDEOS}.`) ? [name] : []
  )
}

function reloadAsTabSwitch(data: ISerialisedGraph | SerialisableGraph) {
  const spy = vi.spyOn(app, 'configuringGraph', 'get').mockReturnValue(true)
  try {
    return reloadSerializedGraph(data, () => new LGraph())
  } finally {
    spy.mockRestore()
  }
}

function nodeIn(graph: LGraph, id: number) {
  const node = graph.getNodeById(toNodeId(id))
  assert.ok(node, `node ${id}`)
  return node
}

function sampleReloads(graph: LGraph, nodeId: number, count: number) {
  const samples = []
  for (let generation = 0; generation < count; generation++) {
    graph = reloadAsTabSwitch(graph.serialize())
    const node = nodeIn(graph, nodeId)
    samples.push({ linked: linked(node), slots: groupSlots(node) })
  }
  return samples
}

function selectModel(node: LGraphNode, option: string) {
  const widget = node.widgets?.find((w) => w.name === 'model')
  assert.ok(widget, 'model widget')
  widget.value = option
}

/** Node 1 is the Seedance node, sources get ids 2.. in connection order. */
function buildGraph(
  option: string | undefined,
  images: number,
  videos: number
) {
  const graph = new LGraph()
  const node = LiteGraph.createNode(TYPE)
  assert.ok(node, 'seedance node')
  graph.add(node)
  if (option) selectModel(node, option)
  const slotOf = (name: string) => node.inputs.findIndex((i) => i.name === name)
  for (const name of seq(`${IMAGES}.image`, images)) {
    const s = new Src()
    graph.add(s)
    s.connect(0, node, slotOf(name))
  }
  for (const name of seq(`${VIDEOS}.video`, videos)) {
    const s = new Src()
    graph.add(s)
    s.connect(1, node, slotOf(name))
  }
  return { graph, node }
}

function withoutLinks(data: ISerialisedGraph, names: string[]) {
  const inputs = data.nodes.flatMap((node) => node.inputs ?? [])
  const outputs = data.nodes.flatMap((node) => node.outputs ?? [])
  const dropped = new Set(
    inputs.filter(({ name }) => names.includes(name)).map(({ link }) => link)
  )
  const kept = (id: number) => !dropped.has(id)
  for (const input of inputs) if (!kept(input.link ?? -1)) input.link = null
  for (const output of outputs)
    output.links = output.links?.filter(kept) ?? null
  data.links = data.links.filter(([id]) => kept(id))
  return data
}

function socketOnlyWorkflow(): SerialisableGraph {
  const sources: SerialisableGraph['nodes'] = [1, 2, 3, 4].map((id) => ({
    id,
    type: 'test/Src',
    pos: [0, id * 100],
    size: [100, 50],
    flags: {},
    order: id - 1,
    mode: 0,
    inputs: [],
    outputs: [
      { name: 'image', type: 'IMAGE', links: id < 4 ? [50 + id] : [] },
      { name: 'video', type: 'VIDEO', links: id < 4 ? [] : [54] }
    ],
    properties: {}
  }))
  return {
    id: 'ab000000-0000-4000-8000-00000000f243',
    version: 1,
    revision: 0,
    state: { lastNodeId: 26, lastLinkId: 54, lastGroupId: 0, lastRerouteId: 0 },
    nodes: [
      ...sources,
      {
        id: 26,
        type: TYPE,
        pos: [300, 0],
        size: [300, 400],
        flags: {},
        order: 4,
        mode: 0,
        inputs: [
          { name: image(1), type: 'IMAGE', link: 51 },
          { name: image(2), type: 'IMAGE', link: 52 },
          { name: image(3), type: 'IMAGE', link: 53 },
          { name: video(1), type: 'VIDEO', link: 54 },
          { name: 'model.reference_audios.audio_1', type: 'AUDIO', link: null },
          { name: 'model.reference_assets.asset_1', type: 'STRING', link: null }
        ],
        outputs: [{ name: 'VIDEO', type: 'VIDEO', links: [] }],
        properties: {},
        widgets_values: ['Seedance 2.0', '', '480p', '16:9', 5, true, true]
      }
    ],
    links: [51, 52, 53, 54].map((id) => ({
      id,
      origin_id: id - 50,
      origin_slot: id === 54 ? 1 : 0,
      target_id: 26,
      target_slot: id - 51,
      type: id === 54 ? 'VIDEO' : 'IMAGE'
    }))
  }
}

describe('Autogrow-in-DynamicCombo links survive a workflow reload (FE-2443)', () => {
  beforeEach(async () => {
    LiteGraph.registerNodeType('test/Src', Src)
    await useLitegraphService().registerNodeDef(TYPE, def)
  })

  test.for([
    {
      name: 'untouched option, model saved last, no gaps',
      option: undefined,
      images: 6,
      videos: 2,
      gaps: [],
      linked: [
        `${image(1)}<-2`,
        `${image(2)}<-3`,
        `${image(3)}<-4`,
        `${image(4)}<-5`,
        `${image(5)}<-6`,
        `${image(6)}<-7`,
        `${video(1)}<-8`,
        `${video(2)}<-9`
      ],
      slots: [...seq(`${IMAGES}.image`, 7), ...seq(`${VIDEOS}.video`, 3)]
    },
    {
      name: 'option set, model saved first, no gaps',
      option: 'Seedance 2.0 Fast',
      images: 6,
      videos: 2,
      gaps: [],
      linked: [
        `${image(1)}<-2`,
        `${image(2)}<-3`,
        `${image(3)}<-4`,
        `${image(4)}<-5`,
        `${image(5)}<-6`,
        `${image(6)}<-7`,
        `${video(1)}<-8`,
        `${video(2)}<-9`
      ],
      slots: [...seq(`${IMAGES}.image`, 7), ...seq(`${VIDEOS}.video`, 3)]
    },
    {
      name: 'untouched option, gaps inside the image group',
      option: undefined,
      images: 5,
      videos: 0,
      gaps: [image(3), image(4)],
      linked: [`${image(1)}<-2`, `${image(2)}<-3`, `${image(5)}<-6`],
      slots: [...seq(`${IMAGES}.image`, 6), video(1)]
    },
    {
      name: 'option set, model saved first, gaps in both groups',
      option: 'Seedance 2.0 Fast',
      images: 5,
      videos: 2,
      gaps: [image(3), image(4), video(1)],
      linked: [
        `${image(1)}<-2`,
        `${image(2)}<-3`,
        `${image(5)}<-6`,
        `${video(2)}<-8`
      ],
      slots: [...seq(`${IMAGES}.image`, 6), ...seq(`${VIDEOS}.video`, 3)]
    }
  ])(
    '$name keeps its links and slots',
    ({ option, images, videos, gaps, linked: expectedLinked, slots }) => {
      const { graph, node } = buildGraph(option, images, videos)
      const saved = withoutLinks(graph.serialize(), gaps)

      const reloadedNode = nodeIn(reloadAsTabSwitch(saved), Number(node.id))

      expect({
        linked: linked(reloadedNode),
        slots: groupSlots(reloadedNode)
      }).toEqual({ linked: expectedLinked, slots })
    }
  )

  test.for([
    {
      images: 1,
      linked: [`${image(1)}<-2`, `${video(1)}<-3`, `${video(2)}<-4`],
      slots: [image(1), image(2), video(1), video(2), video(3)]
    },
    {
      images: 6,
      linked: [
        `${image(1)}<-2`,
        `${image(2)}<-3`,
        `${image(3)}<-4`,
        `${image(4)}<-5`,
        `${image(5)}<-6`,
        `${image(6)}<-7`,
        `${video(1)}<-8`,
        `${video(2)}<-9`
      ],
      slots: [...seq(`${IMAGES}.image`, 7), ...seq(`${VIDEOS}.video`, 3)]
    }
  ])(
    '$images image and 2 video links keep their endpoints and slots over six reloads',
    ({ images, linked, slots }) => {
      const { graph, node } = buildGraph(undefined, images, 2)

      expect(sampleReloads(graph, Number(node.id), 6)).toEqual(
        Array.from({ length: 6 }, () => ({ linked, slots }))
      )
    }
  )

  test.for([
    {
      min: 0,
      images: 5,
      videos: 0,
      linked: [
        `${image(1)}<-2`,
        `${image(2)}<-3`,
        `${image(3)}<-4`,
        `${image(4)}<-5`,
        `${image(5)}<-6`
      ],
      slots: [...seq(`${IMAGES}.image`, 6), video(1)]
    },
    {
      min: 2,
      images: 6,
      videos: 2,
      linked: [
        `${image(1)}<-2`,
        `${image(2)}<-3`,
        `${image(3)}<-4`,
        `${image(4)}<-5`,
        `${image(5)}<-6`,
        `${image(6)}<-7`,
        `${video(1)}<-8`,
        `${video(2)}<-9`
      ],
      slots: [...seq(`${IMAGES}.image`, 7), ...seq(`${VIDEOS}.video`, 3)]
    },
    {
      min: 4,
      images: 8,
      videos: 3,
      linked: [
        `${image(1)}<-2`,
        `${image(2)}<-3`,
        `${image(3)}<-4`,
        `${image(4)}<-5`,
        `${image(5)}<-6`,
        `${image(6)}<-7`,
        `${image(7)}<-8`,
        `${image(8)}<-9`,
        `${video(1)}<-10`,
        `${video(2)}<-11`,
        `${video(3)}<-12`
      ],
      slots: [...seq(`${IMAGES}.image`, 9), ...seq(`${VIDEOS}.video`, 3)]
    }
  ])(
    'restores a non-default option with min=$min, $images images and $videos videos',
    async ({ min, images, videos, linked: expectedLinked, slots }) => {
      await useLitegraphService().registerNodeDef(
        TYPE,
        nonDefaultReferencesDef(ag('IMAGE', 'image', seq('image', 9), min))
      )
      const { graph, node } = buildGraph('with references', images, videos)

      const reloadedNode = nodeIn(
        reloadAsTabSwitch(graph.serialize()),
        Number(node.id)
      )

      expect({
        linked: linked(reloadedNode),
        slots: groupSlots(reloadedNode)
      }).toEqual({ linked: expectedLinked, slots })
    }
  )

  test.for([
    { ordinal: 3, expected: `${IMAGES}.image_3` },
    { ordinal: 4, expected: undefined },
    { ordinal: 900_000_000, expected: undefined }
  ])(
    'bounds growth of prefix ordinal $ordinal by the group maximum',
    async ({ ordinal, expected }) => {
      await useLitegraphService().registerNodeDef(
        TYPE,
        nonDefaultReferencesDef(prefixImages)
      )
      const { graph, node } = buildGraph('with references', 0, 0)
      vi.spyOn(graph, 'setDirtyCanvas').mockImplementation(() => {
        if (vi.mocked(graph.setDirtyCanvas).mock.calls.length > 100)
          throw new Error('Autogrow exceeded its canvas invalidation budget')
      })

      const slot = growAutogrowInput(node, `${IMAGES}.image_${ordinal}`)

      expect({
        input: slot === undefined ? undefined : node.inputs[slot].name,
        slots: groupSlots(node)
      }).toEqual({
        input: expected,
        slots: [`${IMAGES}.image_0`, image(1), image(2), image(3), video(1)]
      })
    }
  )

  test('switching the option by hand hands over only the fresh layout', () => {
    const { node } = buildGraph(undefined, 6, 2)

    selectModel(node, 'Seedance 2.0 Fast')

    expect(linked(node)).toEqual([`${image(1)}<-2`, `${video(1)}<-8`])
  })

  test('after a reload, switching the option by hand hands over only the fresh layout', () => {
    const { graph, node } = buildGraph(undefined, 6, 2)
    const reloadedNode = nodeIn(
      reloadAsTabSwitch(graph.serialize()),
      Number(node.id)
    )

    selectModel(reloadedNode, 'Seedance 2.0 Fast')

    expect(linked(reloadedNode)).toEqual([`${image(1)}<-2`, `${video(1)}<-8`])
  })

  test('a socket-only save loads with every reference connected and one spare slot per group', () => {
    const node = nodeIn(reloadAsTabSwitch(socketOnlyWorkflow()), 26)

    expect({ linked: linked(node), slots: groupSlots(node) }).toEqual({
      linked: [
        `${image(1)}<-1`,
        `${image(2)}<-2`,
        `${image(3)}<-3`,
        `${video(1)}<-4`
      ],
      slots: [...seq(`${IMAGES}.image`, 4), video(1), video(2)]
    })
  })
})
