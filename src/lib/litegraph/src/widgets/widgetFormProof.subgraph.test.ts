import { beforeEach, describe, expect, it } from 'vitest'

import { LegacyWidget, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { CapturedSerialization } from '@/lib/litegraph/src/widgets/__fixtures__/widgetFormProofHarness'
import {
  coreIsLastWriter,
  serializeWithCapture
} from '@/lib/litegraph/src/widgets/__fixtures__/widgetFormProofHarness'
import { proveWidgetForm } from '@/lib/litegraph/src/widgets/widgetFormProof'
import type { WidgetFormProof } from '@/lib/litegraph/src/widgets/widgetFormProof'

function proveAgainstFinalPayload(
  node: LGraphNode,
  captured: CapturedSerialization,
  claimedLastWriter = coreIsLastWriter(node)
) {
  return proveWidgetForm(node.widgets, captured.final, captured.atCoreSite, {
    serializeWidgets: node.serialize_widgets,
    replayed: false,
    coreIsLastWriter: claimedLastWriter
  })
}

function proveAgainstCoreSitePayload(
  node: LGraphNode,
  captured: CapturedSerialization
) {
  return proveWidgetForm(
    captured.widgetsAtCoreSite,
    { widgets_values: captured.atCoreSite },
    captured.atCoreSite,
    {
      serializeWidgets: node.serialize_widgets,
      replayed: false,
      coreIsLastWriter: coreIsLastWriter(node)
    }
  )
}

function interiorNode(widgetName: string, value: number): LGraphNode {
  const node = new LGraphNode('Interior')
  const input = node.addInput(widgetName, 'number')
  node.addOutput('out', 'number')
  const widget: LegacyWidget = new LegacyWidget(
    { name: widgetName, type: 'number', value, y: 0, options: {}, node },
    node
  )
  node.widgets = [widget]
  input.widget = { name: widget.name }
  return node
}

function subgraphHostWithPromotedInputs(
  names: readonly string[]
): SubgraphNode {
  const subgraph: Subgraph = createTestSubgraph({
    inputs: names.map((name) => ({ name, type: 'number' as const }))
  })
  for (const [index, name] of names.entries()) {
    const interior = interiorNode(name, index + 1)
    subgraph.add(interior)
    subgraph.inputNode.slots[index].connect(interior.inputs[0], interior)
  }
  const host = createTestSubgraphNode(subgraph)
  host.serialize_widgets = true
  return host
}

function clearPromotedValues(node: SubgraphNode): void {
  for (const widget of node.widgets) widget.value = undefined
}

function refusal(reason: NonNullable<WidgetFormProof['refusal']>) {
  return { provable: false, refusal: reason, order: null }
}

beforeEach(() => {
  resetSubgraphFixtureState()
})

describe('the capture harness itself', () => {
  it('observes the produced values without replacing them, so a plain node still proves', () => {
    const node = new LGraphNode('Plain')
    node.serialize_widgets = true
    node.addWidget('number', 'seed', 1, () => {})
    node.addWidget('text', 'prompt', 'hi', () => {})

    const captured = serializeWithCapture(node)

    expect(captured.final.widgets_values).toBe(captured.atCoreSite)
    expect(proveAgainstFinalPayload(node, captured)).toEqual({
      provable: true,
      refusal: null,
      order: ['seed', 'prompt']
    })
  })
})

describe('case 1 — subgraph nodes', () => {
  it('refuses a subgraph host, whose serializeFromStoreState rebuilds widgets_values after core', () => {
    const host = subgraphHostWithPromotedInputs(['alpha', 'beta'])

    const captured = serializeWithCapture(host)

    expect(captured.final.widgets_values).toEqual([1, 2])
    expect(captured.final.widgets_values).not.toBe(captured.atCoreSite)
    expect(proveAgainstFinalPayload(host, captured)).toEqual(
      refusal('class_may_rewrite_payload')
    )
  })

  it('still refuses by array identity when a caller wrongly claims core wrote the final payload', () => {
    const host = subgraphHostWithPromotedInputs(['alpha', 'beta'])

    const captured = serializeWithCapture(host)

    expect(proveAgainstFinalPayload(host, captured, true)).toEqual(
      refusal('values_replaced')
    )
  })

  it('refuses when the subgraph deletes widgets_values because every promoted value is undefined', () => {
    const host = subgraphHostWithPromotedInputs(['alpha'])
    clearPromotedValues(host)

    const captured = serializeWithCapture(host)

    expect('widgets_values' in captured.final).toBe(false)
    expect(proveAgainstFinalPayload(host, captured)).toEqual(
      refusal('class_may_rewrite_payload')
    )
  })
})

describe('case 2 — promoted widgets', () => {
  it('counts every promoted input at core write site, because a projection carries no own serialize flag', () => {
    const host = subgraphHostWithPromotedInputs(['alpha', 'beta'])

    expect(host.widgets.map((widget) => widget.name)).toEqual(['alpha', 'beta'])
    expect(
      host.widgets.some((widget) => Object.hasOwn(widget, 'serialize'))
    ).toBe(false)

    const captured = serializeWithCapture(host)
    expect(captured.atCoreSite).toEqual([1, 2])
  })

  it('refuses a host whose added widget core serializes but the subgraph rebuild then drops', () => {
    const host = subgraphHostWithPromotedInputs(['alpha'])
    host.addWidget('text', 'extra', 'hello', () => {})

    const captured = serializeWithCapture(host)

    expect(captured.atCoreSite).toEqual([1, 'hello'])
    expect(captured.final.widgets_values).toEqual([1])
    expect(proveAgainstFinalPayload(host, captured)).toEqual(
      refusal('class_may_rewrite_payload')
    )
  })
})

describe('the last writer', () => {
  it('refuses a subgraph host at core own post-hook payload, before the subclass rewrites it', () => {
    const host = subgraphHostWithPromotedInputs(['alpha'])
    host.addWidget('text', 'extra', 'hello', () => {})

    const captured = serializeWithCapture(host)

    expect(captured.atCoreSite).toEqual([1, 'hello'])
    expect(captured.final.widgets_values).toEqual([1])
    expect(proveAgainstCoreSitePayload(host, captured)).toEqual(
      refusal('class_may_rewrite_payload')
    )
  })
})
