import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphEventMode,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { graphToPrompt } from '@/utils/executionUtil'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type {
  Comfy,
  NodeDefBuilder,
  NodeHandle,
  PreviewFrame
} from '@/platform/nodeApi/v4/types'
import { addNodeOfType } from './__fixtures__/promptGraphs'

const STASH = 'Pack/Stash'

describe('prompt and preview hooks', () => {
  let graph: LGraph
  let comfy: Comfy
  let host: ComfyApiHost

  beforeEach(() => {
    graph = new LGraph()
    ;({ comfy, host } = createComfyApi({ getGraph: () => graph }))
    comfy.defs.define({ type: STASH, execution: 'backend' })
  })

  function extend(apply: (builder: NodeDefBuilder) => void) {
    return comfy.defs.extend(STASH, apply)
  }

  function addStash(target: LGraph = graph): LGraphNode {
    const node = addNodeOfType(target, STASH)
    node.addWidget('text', 'text', 'typed', () => {})
    node.addWidget('number', 'seed', 3, () => {})
    node.addInput('image', 'IMAGE')
    return node
  }

  async function promptOf() {
    return graphToPrompt(graph, { frontendExecution: host.frontendExecution })
  }

  describe('onPromptSerialize', () => {
    it("leaves the names it gives out of the node's prompt entry, and keeps them in the saved workflow", async () => {
      extend((builder) =>
        builder.onPromptSerialize(() => ({ omitInputs: ['text', 'image'] }))
      )
      const source = addNodeOfType(graph, STASH)
      source.addOutput('out', 'IMAGE')
      const stash = addStash()
      stash.serialize_widgets = true
      source.connect(0, stash, 0)

      const { output, workflow } = await promptOf()

      expect(output[String(stash.id)].inputs).toEqual({ seed: 3 })
      expect(
        workflow.nodes.find(({ id }) => String(id) === String(stash.id))
          ?.widgets_values
      ).toEqual(['typed', 3])
    })

    it('leaves everything in without the hook, the control for the test above', async () => {
      const stash = addStash()

      const { output } = await promptOf()

      expect(output[String(stash.id)].inputs).toEqual({
        text: 'typed',
        seed: 3
      })
    })

    it('leaves out the names every hook gives, and ignores a name the node lacks', async () => {
      extend((builder) => {
        builder.onPromptSerialize(() => ({ omitInputs: ['text'] }))
        builder.onPromptSerialize(() => ({ omitInputs: ['missing'] }))
      })
      extend((builder) =>
        builder.onPromptSerialize(() => ({ omitInputs: ['seed'] }))
      )
      const stash = addStash()

      const { output } = await promptOf()

      expect(output[String(stash.id)].inputs).toEqual({})
    })

    it('leaves nothing out for a hook that returns nothing', async () => {
      extend((builder) => builder.onPromptSerialize(() => {}))
      const stash = addStash()

      const { output } = await promptOf()

      expect(output[String(stash.id)].inputs).toEqual({
        text: 'typed',
        seed: 3
      })
      expect(reportError).not.toHaveBeenCalled()
    })

    it("is called with the node's handle, once for each placement of a subgraph", async () => {
      const calls: NodeHandle[] = []
      extend((builder) =>
        builder.onPromptSerialize((node) => {
          calls.push(node)
          return { omitInputs: ['text'] }
        })
      )
      const subgraph = createTestSubgraph({ rootGraph: graph })
      graph.subgraphs.set(subgraph.id, subgraph)
      const stash = addStash(subgraph)
      const placements = [1, 2].map(() => {
        const placement = createTestSubgraphNode(subgraph)
        graph.add(placement)
        return placement
      })

      const { output } = await promptOf()

      expect(calls).toHaveLength(2)
      expect(calls[0]).toBe(calls[1])
      expect(calls[0]).toMatchObject({
        id: String(stash.id),
        graphId: subgraph.id
      })
      for (const placement of placements) {
        expect(output[`${placement.id}:${stash.id}`].inputs).toEqual({
          seed: 3
        })
      }
    })

    it.for([
      { mode: 'muted', value: LGraphEventMode.NEVER },
      { mode: 'bypassed', value: LGraphEventMode.BYPASS }
    ])(
      'is not called for a $mode node, which the prompt leaves out',
      async ({ value }) => {
        const hook = vi.fn(() => ({ omitInputs: [] }))
        extend((builder) => builder.onPromptSerialize(hook))
        const stash = addStash()
        stash.mode = value

        const { output } = await promptOf()

        expect(output).not.toHaveProperty(String(stash.id))
        expect(hook).not.toHaveBeenCalled()
      }
    )

    it('reports a hook that throws, and keeps the names the others give', async () => {
      extend((builder) => {
        builder.onPromptSerialize(() => {
          throw new Error('broken')
        })
        builder.onPromptSerialize(() => ({ omitInputs: ['seed'] }))
      })
      const stash = addStash()

      const { output } = await promptOf()

      expect(output[String(stash.id)].inputs).toEqual({ text: 'typed' })
      expect(reportError).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'broken' }),
        expect.objectContaining({ tags: { event: 'onPromptSerialize' } })
      )
    })

    it.for([
      { name: 'an answer that is not an object', answer: 'text' },
      { name: 'a list of names', answer: ['text'] },
      { name: 'omitInputs that is not a list', answer: { omitInputs: 'text' } },
      { name: 'a name that is not text', answer: { omitInputs: ['text', 1] } },
      {
        name: 'another field',
        answer: { omitInputs: ['text'], keepInputs: [] }
      }
    ])('reports $name, and leaves nothing out', async ({ answer }) => {
      extend((builder) =>
        Reflect.apply(builder.onPromptSerialize, builder, [() => answer])
      )
      const stash = addStash()

      const { output } = await promptOf()

      expect(output[String(stash.id)].inputs).toEqual({
        text: 'typed',
        seed: 3
      })
      expect(reportError).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('onPromptSerialize needs')
        }),
        expect.anything()
      )
    })

    it('stops leaving names out once its extension is unsubscribed', async () => {
      const stop = extend((builder) =>
        builder.onPromptSerialize(() => ({ omitInputs: ['text'] }))
      )
      const stash = addStash()

      stop()
      const { output } = await promptOf()

      expect(output[String(stash.id)].inputs).toEqual({
        text: 'typed',
        seed: 3
      })
    })

    it('is not called for a node of a class registered over the type it extends', async () => {
      const hook = vi.fn(() => ({ omitInputs: ['text'] }))
      extend((builder) => builder.onPromptSerialize(hook))
      class Legacy extends LGraphNode {}
      LiteGraph.registerNodeType(STASH, Legacy)
      const stash = addStash()
      stash.comfyClass = STASH

      const { output } = await promptOf()

      expect(output[String(stash.id)].inputs).toEqual({
        text: 'typed',
        seed: 3
      })
      expect(hook).not.toHaveBeenCalled()
    })

    it('refuses a hook that is not a function', () => {
      let refusal: unknown
      extend((builder) => {
        try {
          Reflect.apply(builder.onPromptSerialize, builder, [{}])
        } catch (error) {
          refusal = error
        }
      })

      expect(refusal).toBeInstanceOf(TypeError)
    })
  })

  describe('onPreview', () => {
    function previewsHeard() {
      const heard: [NodeHandle, PreviewFrame][] = []
      extend((builder) =>
        builder.onPreview((node, frame) => heard.push([node, frame]))
      )
      return heard
    }

    it('gives the frame to the hooks of the node it is for, with its handle', () => {
      const heard = previewsHeard()
      const stash = addStash()
      const blob = new Blob(['frame'])

      host.deliverPreview(graph, String(stash.id), blob)

      expect(heard).toHaveLength(1)
      const [[node, frame]] = heard
      expect(node).toBe(comfy.graph.node(String(stash.id)))
      expect(frame).toEqual({ blob })
      expect(frame.blob).toBe(blob)
      expect(Object.isFrozen(frame)).toBe(true)
    })

    it('finds a node inside a subgraph by its execution id, in its own graph', () => {
      const heard = previewsHeard()
      const subgraph = createTestSubgraph({ rootGraph: graph })
      graph.subgraphs.set(subgraph.id, subgraph)
      const stash = addStash(subgraph)
      const placement = createTestSubgraphNode(subgraph)
      graph.add(placement)

      host.deliverPreview(graph, `${placement.id}:${stash.id}`, new Blob([]))

      expect(heard.map(([node]) => [node.graphId, node.id])).toEqual([
        [subgraph.id, String(stash.id)]
      ])
    })

    it('gives nothing for a node that is not there, or of another type', () => {
      const heard = previewsHeard()
      const other = addNodeOfType(graph, STASH)
      comfy.defs.define({ type: 'Pack/Other' })
      const unrelated = addNodeOfType(graph, 'Pack/Other')

      host.deliverPreview(graph, '999', new Blob([]))
      host.deliverPreview(graph, String(unrelated.id), new Blob([]))
      expect(heard).toEqual([])

      host.deliverPreview(graph, String(other.id), new Blob([]))
      expect(heard).toHaveLength(1)
    })

    it('gives nothing to a node of a class registered over the type it extends', () => {
      const heard = previewsHeard()
      class Legacy extends LGraphNode {}
      LiteGraph.registerNodeType(STASH, Legacy)
      const stash = addStash()

      host.deliverPreview(graph, String(stash.id), new Blob([]))

      expect(heard).toEqual([])
    })

    it('reports a hook that throws, and still calls the others', () => {
      const after = vi.fn()
      extend((builder) => {
        builder.onPreview(() => {
          throw new Error('broken')
        })
        builder.onPreview(after)
      })
      const stash = addStash()

      host.deliverPreview(graph, String(stash.id), new Blob([]))

      expect(after).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledOnce()
    })

    it('stops once its extension is unsubscribed', () => {
      const hook = vi.fn()
      const stop = extend((builder) => builder.onPreview(hook))
      const stash = addStash()

      stop()
      host.deliverPreview(graph, String(stash.id), new Blob([]))

      expect(hook).not.toHaveBeenCalled()
    })

    it('refuses a hook that is not a function', () => {
      let refusal: unknown
      extend((builder) => {
        try {
          Reflect.apply(builder.onPreview, builder, ['hook'])
        } catch (error) {
          refusal = error
        }
      })

      expect(refusal).toBeInstanceOf(TypeError)
      assert(refusal instanceof TypeError)
      expect(refusal.message).toContain('onPreview')
    })
  })
})
