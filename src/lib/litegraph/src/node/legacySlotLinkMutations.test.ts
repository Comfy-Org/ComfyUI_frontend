import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'

function connectedPair() {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  graph.add(source)

  const target = new LGraphNode('Target')
  target.addInput('in', 'INT')
  graph.add(target)

  const link = source.connect(0, target, 0)!
  return { graph, source, target, link }
}

function fanOut(count: number) {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  graph.add(source)

  const targets = Array.from({ length: count }, (_, index) => {
    const target = new LGraphNode(`Target ${index}`)
    target.addInput('in', 'INT')
    graph.add(target)
    source.connect(0, target, 0)
    return target
  })

  return { graph, source, targets }
}

describe('legacy slot link removal', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('propagates input.link = null to the far end of the link', () => {
    const { source, target } = connectedPair()

    target.inputs[0].link = null

    expect(target.isInputConnected(0)).toBe(false)
    expect(source.isOutputConnected(0)).toBe(false)
    expect(source.outputs[0].links).toBeNull()
    expect(source.getOutputNodes(0) ?? []).toHaveLength(0)
  })

  it('disconnects the links a filter-and-reassign drops', () => {
    const { source, targets } = fanOut(3)
    const output = source.outputs[0]
    const [dropped, , alsoDropped] = output.links!

    output.links = output.links!.filter(
      (id) => id !== dropped && id !== alsoDropped
    )

    expect(targets[0].isInputConnected(0)).toBe(false)
    expect(targets[2].isInputConnected(0)).toBe(false)
    expect(targets[1].isInputConnected(0)).toBe(true)
    expect(source.getOutputNodes(0)).toEqual([targets[1]])
  })

  it('disconnects each link spliced out of the retained view in turn', () => {
    const { source, targets } = fanOut(3)
    const view = source.outputs[0].links!

    for (const id of [...view]) view.splice(view.indexOf(id), 1)

    for (const [index, target] of targets.entries()) {
      expect(target.isInputConnected(0), `target ${index}`).toBe(false)
    }
    expect(source.isOutputConnected(0)).toBe(false)
  })

  it('disconnects everything when the view is truncated by length', () => {
    // `length` is a property write rather than an array method, so it reaches
    // the mutation view through a different trap than the cases above.
    const { source, targets } = fanOut(2)
    const view = source.outputs[0].links!

    view.length = 0

    expect(targets.every((target) => !target.isInputConnected(0))).toBe(true)
    expect(source.isOutputConnected(0)).toBe(false)
  })

  it('ignores removals on slots detached from their node', () => {
    const { source, target } = connectedPair()
    const [detachedInput] = target.inputs.splice(0, 1)
    const [detachedOutput] = source.outputs.splice(0, 1)

    expect(() => {
      detachedInput.link = null
      detachedOutput.links = []
    }).not.toThrow()
  })
})

describe('legacy slot link additions', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('ignores assigning a disconnected id to an input', () => {
    const { source, target } = connectedPair()
    const saved = target.inputs[0].link

    target.inputs[0].link = null
    target.inputs[0].link = saved

    expect(target.inputs[0].link).toBeNull()
    expect(source.isOutputConnected(0)).toBe(false)
  })

  it('ignores adding a disconnected id to an output view', () => {
    const { source, target } = connectedPair()
    const output = source.outputs[0]
    const [id] = output.links!

    output.links = []
    output.links!.push(id)

    expect(source.isOutputConnected(0)).toBe(false)
    expect(target.isInputConnected(0)).toBe(false)
    expect(output.links).toEqual([])
  })
})

function autogrowChain(inputCount: number, connectedSlots: number[]) {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'STRING')
  graph.add(source)

  const target = new LGraphNode('PromptChain')
  for (let i = 0; i < inputCount; i++) {
    target.addInput(`inputs.in_${i}`, 'STRING')
  }
  graph.add(target)
  for (const slot of connectedSlots) source.connect(0, target, slot)

  return { graph, source, target }
}

/** mobcat40/ComfyUI-PromptChain js/lib/order-chain.js:123 `updateInputLabels`. */
function replaceSlotsWithLabelledCopies(node: LGraphNode) {
  for (const [index, slot] of node.inputs.entries()) {
    if (!slot.name.includes('in_')) continue
    slot.label = slot.link == null ? 'in' : 'PromptChain'
    node.inputs[index] = { ...slot }
  }
}

/** mobcat40/ComfyUI-PromptChain js/main.js:507 `trimEmptyAutogrowSlots`. */
function trimEmptyAutogrowSlots(node: LGraphNode) {
  const { inputs } = node
  const autogrow = inputs.filter((input) => input.name.startsWith('inputs.in_'))
  if (autogrow.length <= 1) return

  const lastConnected = autogrow.findLastIndex((input) => input.link != null)
  const keepCount = Math.max(1, lastConnected + 2)
  if (keepCount >= autogrow.length) return

  for (const input of autogrow.slice(keepCount)) {
    const index = inputs.indexOf(input)
    if (index !== -1) inputs.splice(index, 1)
  }
}

describe('comfyui-promptchain indexed slot replacement', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('keeps the link store correct when the pack replaces every slot', () => {
    const { graph, target } = autogrowChain(4, [0, 1, 2])

    replaceSlotsWithLabelledCopies(target)
    target.removeInput(0)

    expect(target.inputs).toHaveLength(3)
    expect(graph.links.size).toBe(2)
    expect(target.isInputConnected(0)).toBe(true)
    expect(target.isInputConnected(1)).toBe(true)
    expect(target.isInputConnected(2)).toBe(false)
  })

  it('accepts every endpoint batch in the promptchain sequence', () => {
    const live = autogrowChain(4, [0, 1, 2])
    const updateEndpoints = vi.spyOn(useLinkStore(), 'updateEndpoints')

    replaceSlotsWithLabelledCopies(live.target)
    trimEmptyAutogrowSlots(live.target)
    replaceSlotsWithLabelledCopies(live.target)
    live.target.removeInput(0)

    expect(updateEndpoints).toHaveBeenCalledOnce()
    expect(updateEndpoints).toHaveReturnedWith(
      expect.objectContaining({ ok: true })
    )
  })

  it('keeps the input layout when the endpoint batch is rejected', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const forced = autogrowChain(4, [0, 1, 2])
    const layoutBefore = forced.target.inputs.map((input) => input.name)
    vi.spyOn(useLinkStore(), 'updateEndpoints').mockReturnValue({
      ok: false,
      error: { code: 'occupied-target', message: 'forced' }
    })
    forced.target.removeInput(0)

    expect(consoleError).toHaveBeenCalledWith('Failed to replace node inputs', {
      code: 'occupied-target',
      message: 'forced'
    })
    expect(forced.target.inputs.map((input) => input.name)).toEqual(
      layoutBefore
    )
  })

  it('retains every link in the serialized workflow after trimming slots', () => {
    const { graph, target } = autogrowChain(4, [0, 1, 2])

    replaceSlotsWithLabelledCopies(target)
    trimEmptyAutogrowSlots(target)

    expect(
      graph.serialize().links.map(([, , , , targetSlot]) => targetSlot)
    ).toEqual([0, 1, 2])
  })

  it('keeps every input when the same trim reads live slots', () => {
    const { graph, target } = autogrowChain(4, [0, 1, 2])

    trimEmptyAutogrowSlots(target)

    expect(target.inputs).toHaveLength(4)
    expect(graph.links.size).toBe(3)
  })
})
