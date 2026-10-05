import { beforeEach, describe, expect, test, vi } from 'vitest'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ISerialisedGraph,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import { app } from '@/scripts/app'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

/** Shaped after ByteDance2ReferenceNodeV2 (`_seedance2_reference_inputs`). */
const TYPE = 'test/SeedanceRef'
const IMAGES = 'model.reference_images'
const VIDEOS = 'model.reference_videos'
const ag = (inputType: string, key: string, names: string[]) => [
  'COMFY_AUTOGROW_V3',
  {
    template: { input: { required: { [key]: [inputType, {}] } }, names, min: 0 }
  }
]
const seq = (p: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${p}_${i + 1}`)
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
  } as never,
  output: ['VIDEO'],
  output_name: ['VIDEO'],
  output_node: false
}

class Src extends LGraphNode {
  constructor() {
    super('Src')
    this.addOutput('image', 'IMAGE')
    this.addOutput('video', 'VIDEO')
  }
}

const linked = (n: LGraphNode) =>
  n.inputs.flatMap((inp, slot) => (n.getInputLink(slot) ? [inp.name] : []))
const groupSlots = (n: LGraphNode) =>
  n.inputs.flatMap(({ name }) =>
    name.startsWith(`${IMAGES}.`) || name.startsWith(`${VIDEOS}.`) ? [name] : []
  )
const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))
const settle = async () => {
  await frame()
  await frame()
}

/** A tab switch reloads through LGraph.configure with configuringGraph = true. */
function reload(data: ISerialisedGraph | SerialisableGraph): LGraph {
  const spy = vi.spyOn(app, 'configuringGraph', 'get').mockReturnValue(true)
  try {
    const reloaded = new LGraph()
    reloaded.configure(data)
    return reloaded
  } finally {
    spy.mockRestore()
  }
}

/** Connects the first `images` image slots and `videos` video slots in turn. */
function buildGraph(
  option: string | undefined,
  images: number,
  videos: number
) {
  const graph = new LGraph()
  const node = LiteGraph.createNode(TYPE)!
  graph.add(node)
  if (option) node.widgets!.find((w) => w.name === 'model')!.value = option
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

/** Removes the links of the named inputs from a saved graph, leaving gaps. */
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

describe('Autogrow-in-DynamicCombo links survive a workflow reload (FE-2443)', () => {
  beforeEach(async () => {
    LiteGraph.registerNodeType('test/Src', Src)
    await useLitegraphService().registerNodeDef(TYPE, def)
  })

  const cases = [
    { option: undefined, images: 6, videos: 2, gaps: [] },
    { option: 'Seedance 2.0', images: 6, videos: 2, gaps: [] },
    { option: 'Seedance 2.0 Fast', images: 6, videos: 2, gaps: [] },
    { option: undefined, images: 5, videos: 0, gaps: ['image_3', 'image_4'] },
    {
      option: 'Seedance 2.0 Fast',
      images: 5,
      videos: 2,
      gaps: ['image_3', 'image_4', 'video_1']
    }
  ]
  for (const { option, images, videos, gaps } of cases)
    test(`${images} images + ${videos} videos, gaps [${gaps}] (model ${option ?? 'untouched'}) keep their links and slots`, async () => {
      const { graph, node } = buildGraph(option, images, videos)
      const gapNames = gaps.map(
        (gap) => `model.reference_${gap.split('_')[0]}s.${gap}`
      )
      const saved = withoutLinks(structuredClone(graph.serialize()), gapNames)
      const expected = {
        linked: linked(node).filter((name) => !gapNames.includes(name)),
        slots: groupSlots(node)
      }
      expect(expected.linked).toHaveLength(images + videos - gaps.length)

      const reloaded = reload(saved)
      await settle()
      const reloadedNode = reloaded.getNodeById(node.id)!
      expect({
        linked: linked(reloadedNode),
        slots: groupSlots(reloadedNode)
      }).toEqual(expected)
    })

  test('a second round-trip of the reloaded graph keeps the same links and slots', async () => {
    const { graph, node } = buildGraph(undefined, 6, 2)
    const before = { linked: linked(node), slots: groupSlots(node) }

    const once = reload(structuredClone(graph.serialize()))
    await settle()
    const twice = reload(structuredClone(once.serialize()))
    await settle()

    const twiceNode = twice.getNodeById(node.id)!
    expect({ linked: linked(twiceNode), slots: groupSlots(twiceNode) }).toEqual(
      before
    )
  })

  test('switching the option by hand after a reload still hands over only the fresh layout', async () => {
    const fresh = buildGraph(undefined, 6, 2)
    fresh.node.widgets!.find((w) => w.name === 'model')!.value =
      'Seedance 2.0 Fast'
    await settle()
    const interactive = linked(fresh.node)
    expect(interactive).toEqual([`${IMAGES}.image_1`, `${VIDEOS}.video_1`])

    const { graph, node } = buildGraph(undefined, 6, 2)
    const reloaded = reload(structuredClone(graph.serialize()))
    await settle()
    const reloadedNode = reloaded.getNodeById(node.id)!
    reloadedNode.widgets!.find((w) => w.name === 'model')!.value =
      'Seedance 2.0 Fast'
    await settle()

    expect(linked(reloadedNode)).toEqual(interactive)
  })

  /**
   * The saved shape of `browser_tests/assets/subgraphs/autogrow-reference-images.json`:
   * only sockets are serialized, the combo value rides in `widgets_values`,
   * and the links count slots in that socket-only layout.
   */
  function socketOnlyWorkflow(): SerialisableGraph {
    const sources = [1, 2, 3].map((id) => ({
      id,
      type: 'test/Src',
      pos: [0, id * 100] as [number, number],
      size: [100, 50] as [number, number],
      flags: {},
      order: id - 1,
      mode: 0,
      inputs: [],
      outputs: [
        { name: 'image', type: 'IMAGE', links: [50 + id] },
        { name: 'video', type: 'VIDEO', links: [] }
      ],
      properties: {}
    }))
    return {
      id: 'ab000000-0000-4000-8000-00000000f243',
      version: 1,
      revision: 0,
      state: {
        lastNodeId: 26,
        lastLinkId: 53,
        lastGroupId: 0,
        lastRerouteId: 0
      },
      nodes: [
        ...sources,
        {
          id: 26,
          type: TYPE,
          pos: [300, 0],
          size: [300, 400],
          flags: {},
          order: 3,
          mode: 0,
          inputs: [
            { name: `${IMAGES}.image_1`, type: 'IMAGE', link: 51 },
            { name: `${IMAGES}.image_2`, type: 'IMAGE', link: 52 },
            { name: `${IMAGES}.image_3`, type: 'IMAGE', link: 53 },
            { name: `${VIDEOS}.video_1`, type: 'VIDEO', link: null },
            {
              name: 'model.reference_audios.audio_1',
              type: 'AUDIO',
              link: null
            },
            {
              name: 'model.reference_assets.asset_1',
              type: 'STRING',
              link: null
            }
          ],
          outputs: [{ name: 'VIDEO', type: 'VIDEO', links: [] }],
          properties: {},
          widgets_values: ['Seedance 2.0', '', '480p', '16:9', 5, true, true]
        }
      ],
      links: [51, 52, 53].map((id) => ({
        id: toLinkId(id),
        origin_id: id - 50,
        origin_slot: 0,
        target_id: 26,
        target_slot: id - 51,
        type: 'IMAGE'
      }))
    }
  }

  test('a socket-only save loads with every reference image connected and one spare slot', async () => {
    const graph = reload(socketOnlyWorkflow())
    await settle()

    const node = graph.getNodeById(toNodeId(26))!
    expect({
      linked: linked(node),
      images: node.inputs.flatMap(({ name }) =>
        name.startsWith(`${IMAGES}.`) ? [name] : []
      )
    }).toEqual({
      linked: seq(`${IMAGES}.image`, 3),
      images: seq(`${IMAGES}.image`, 4)
    })
  })
})
