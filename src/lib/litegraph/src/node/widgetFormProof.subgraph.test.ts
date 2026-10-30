import { beforeEach, describe, expect, it } from 'vitest'

import { LegacyWidget, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { proveWidgetForm } from '@/lib/litegraph/src/node/widgetFormProof'
import type { WidgetFormRefusal } from '@/lib/litegraph/src/node/widgetFormProof'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

/**
 * What {@link proveWidgetForm} is handed when a REAL `SubgraphNode` serializes: subgraph nodes,
 * promoted widgets, and the store projections that stand in for them.
 *
 * `widgetFormProof.test.ts` tests the predicate against constructed arguments. This file tests
 * the arguments, because for a subgraph host that is where the answer lives — the payload has
 * two writers and the predicate only sees whichever one the caller shows it. DOM widgets are the
 * fourth case and live in `src/extensions/core/widgetFormProof.domWidgets.test.ts`, with the
 * widget constructors they drive.
 *
 * The invariant is one-directional — either no form, or a form that agrees; never a form that
 * disagrees — so every `provable: false` here is a pass, not a limitation.
 */

interface CapturedSerialization {
  /** The payload as finally returned, after the subclass override has run. */
  final: ISerialisedNode
  /**
   * `widgets_values` at core's own write site: produced by `serialiseWidgetValues` and observed
   * from inside the extension serialize hook, which is the moment the predicate's docstring calls
   * "AFTER the extension serialize hook". For a plain node that is also the final payload. For a
   * `SubgraphNode` it is not.
   */
  atCoreSite: unknown
  /** `node.widgets` read at that same moment. */
  widgetsAtCoreSite: readonly IBaseWidget[] | undefined
}

/**
 * Serialize for real, capturing the payload at core's write site as well as the final one.
 *
 * The capture rides on `onSerialize` because that hook receives the very object core wrote into,
 * so the array IDENTITY the proof turns on is observable without reaching into the module.
 * Installing a hook does not perturb that identity: `runExtensionSerializeHook` rewrites a
 * canonical field only when it is NOT structured-cloneable, and an array of plain values always
 * is. The first test asserts that rather than assuming it.
 */
function serializeWithCapture(node: LGraphNode): CapturedSerialization {
  let atCoreSite: unknown
  let widgetsAtCoreSite: readonly IBaseWidget[] | undefined
  const previous = node.onSerialize
  node.onSerialize = function (data: ISerialisedNode) {
    atCoreSite = data.widgets_values
    widgetsAtCoreSite = this.widgets
    previous?.call(this, data)
  }
  try {
    return { final: node.serialize(), atCoreSite, widgetsAtCoreSite }
  } finally {
    node.onSerialize = previous
  }
}

/** Prove against the payload the caller will actually persist. */
function proveAgainstFinalPayload(
  node: LGraphNode,
  captured: CapturedSerialization
) {
  return proveWidgetForm(node.widgets, captured.final, captured.atCoreSite, {
    serializeWidgets: node.serialize_widgets
  })
}

/** Prove against core's own post-hook payload, before any subclass has rewritten it. */
function proveAgainstCoreSitePayload(
  node: LGraphNode,
  captured: CapturedSerialization
) {
  return proveWidgetForm(
    captured.widgetsAtCoreSite,
    { widgets_values: captured.atCoreSite },
    captured.atCoreSite,
    { serializeWidgets: node.serialize_widgets }
  )
}

/** An interior node with one widget-backed input, ready to be promoted. */
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

/** A subgraph host whose named inputs are promoted from interior widgets. */
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
  // Mirrors the real subgraph node class in litegraphService, which sets this in its constructor.
  // Nothing in litegraph sets it, so without this line no values are written at all and every
  // case below would refuse for the uninteresting reason.
  host.serialize_widgets = true
  return host
}

/**
 * Clear every promoted value through the projection's own setter, which is the only way a value
 * reaches the store in production. An all-undefined promoted set is what takes the subgraph's
 * `delete serialized.widgets_values` branch.
 */
function clearPromotedValues(node: SubgraphNode): void {
  for (const widget of node.widgets) widget.value = undefined
}

/**
 * The exact shape a refusal must have. Typing the reason as `WidgetFormRefusal` means a renamed
 * or deleted refusal fails typecheck here instead of silently becoming an unasserted string.
 */
function refusal(reason: WidgetFormRefusal) {
  return { provable: false, refusal: reason, order: null }
}

beforeEach(() => {
  resetSubgraphFixtureState()
})

describe('the capture harness itself', () => {
  it('observes the produced values without replacing them', () => {
    const node = new LGraphNode('Plain')
    node.serialize_widgets = true
    node.addWidget('number', 'seed', 1, () => {})
    node.addWidget('text', 'prompt', 'hi', () => {})

    const captured = serializeWithCapture(node)

    // Same array object before and after the hook, so an acceptance below is a fact about the
    // node and not an artifact of observing it.
    expect(captured.final.widgets_values).toBe(captured.atCoreSite)
    expect(proveAgainstFinalPayload(node, captured)).toEqual({
      provable: true,
      refusal: null,
      order: ['seed', 'prompt']
    })
  })
})

describe('case 1 — subgraph nodes', () => {
  it('refuses, because the final widgets_values is not the array core produced', () => {
    // SubgraphNode.serializeFromStoreState calls super -- extension hook included -- and then
    // rebuilds widgets_values from `inputs` filtered to those carrying a widgetId. Equal-looking
    // contents, different array, built from a collection core never saw. Identity catches it.
    const host = subgraphHostWithPromotedInputs(['alpha', 'beta'])

    const captured = serializeWithCapture(host)

    expect(captured.final.widgets_values).toEqual([1, 2])
    expect(captured.final.widgets_values).not.toBe(captured.atCoreSite)
    expect(proveAgainstFinalPayload(host, captured)).toEqual(
      refusal('values_replaced')
    )
  })

  it('refuses when the subgraph deletes the values outright', () => {
    // The `delete serialized.widgets_values` branch, taken when every promoted store value is
    // undefined. A form here would promise addresses into an array the payload does not carry.
    const host = subgraphHostWithPromotedInputs(['alpha'])
    clearPromotedValues(host)

    const captured = serializeWithCapture(host)

    expect('widgets_values' in captured.final).toBe(false)
    const proof = proveAgainstFinalPayload(host, captured)
    expect(proof.provable).toBe(false)
    expect(proof.order).toBeNull()
  })

  it('reads a fresh widget array on every access, so widgets cannot be identity-checked', () => {
    // `widgets` is a computed getter on SubgraphNode: projections off `inputs`, then
    // `_extraWidgets`. The array is new on each access even when nothing changed, which is why
    // the proof checks the identity of the VALUES and not of the widget list.
    const host = subgraphHostWithPromotedInputs(['alpha'])

    expect(host.widgets).not.toBe(host.widgets)
    expect(host.widgets).toEqual(host.widgets)
  })
})

describe('case 2 — promoted widgets', () => {
  it('counts every promoted input, because a projection carries no serialize flag', () => {
    // The projection is built fresh from the store and has no own `serialize` property, so
    // `serialize !== false` holds and each promoted input occupies a positional slot.
    const host = subgraphHostWithPromotedInputs(['alpha', 'beta'])

    expect(host.widgets.map((widget) => widget.name)).toEqual(['alpha', 'beta'])
    expect(
      host.widgets.some((widget) => Object.hasOwn(widget, 'serialize'))
    ).toBe(false)

    const captured = serializeWithCapture(host)
    expect(captured.atCoreSite).toEqual([1, 2])
  })

  it('refuses a host carrying an addCustomWidget widget the final writer then drops', () => {
    // `_extraWidgets` are in `node.widgets`, so they DO contribute a value at core's write site --
    // and they are absent from `inputs`, so the subgraph's final rebuild drops them. The payload
    // therefore ends up one value short of the widget list that produced it.
    const host = subgraphHostWithPromotedInputs(['alpha'])
    host.addCustomWidget({
      name: 'extra',
      type: 'text',
      value: 'hello'
    } as IBaseWidget)

    const captured = serializeWithCapture(host)

    expect(captured.atCoreSite).toEqual([1, 'hello'])
    expect(captured.final.widgets_values).toEqual([1])
    expect(proveAgainstFinalPayload(host, captured)).toEqual(
      refusal('values_replaced')
    )
  })
})

describe('case 3 — widget projections', () => {
  it('names a projection from the store, not from its display label', () => {
    const host = subgraphHostWithPromotedInputs(['alpha'])
    expect(host.widgets[0].name).toBe('alpha')

    // Projections read through the store on every property access, with no cache to invalidate.
    // Relabelling is a display change and must not move the address a form would publish: the
    // name is the stable identifier the document resolves against.
    host.widgets[0].label = 'renamed'
    expect(host.widgets[0].label).toBe('renamed')
    expect(host.widgets[0].name).toBe('alpha')
  })

  it('refuses a projection the store no longer backs, rather than naming it from nowhere', () => {
    // A projection whose store value has gone reports `value: undefined` while still occupying a
    // slot. The subgraph then deletes the payload, so there is nothing left to describe.
    const host = subgraphHostWithPromotedInputs(['alpha'])
    clearPromotedValues(host)

    const captured = serializeWithCapture(host)

    expect(host.widgets[0].value).toBeUndefined()
    expect(host.widgets[0].name).toBe('alpha')
    expect(proveAgainstFinalPayload(host, captured).provable).toBe(false)
  })
})

describe('the call site the predicate documents is not the last writer', () => {
  /**
   * EXPECTED FAILURE — live defect, not a limitation of the test.
   *
   * `proveWidgetForm` documents `serialised` as "the node payload as it stands AFTER the
   * extension serialize hook", and the only place core holds such a payload is the end of
   * `LGraphNode.serializeFromStoreState`. At that point a `SubgraphNode` has not yet rewritten
   * `widgets_values`, so the identity check -- the predicate's stated defence against exactly
   * this subclass -- passes, and the proof returns a form the final payload contradicts.
   *
   * Below, the accepted order names two widgets while the array the form would be attached to
   * ends up holding one value. Emitted, that form is authoritative and misplaces values with
   * nothing downstream able to disagree.
   *
   * The fix is to stop making the caller responsible for knowing it stands at the last writer:
   * refuse when the node's class can still rewrite the payload -- when the node's
   * `serializeFromStoreState` is not `LGraphNode.prototype`'s -- as a new refusal reason beside
   * the existing seven. Core can make that check from what it already has, it covers packs that
   * override `serialize` as well as `SubgraphNode`, and it keeps the module's own rule intact:
   * prove core is the last writer, do not assume it.
   */
  it.fails('refuses a subgraph host at core own post-hook payload', () => {
    const host = subgraphHostWithPromotedInputs(['alpha'])
    host.addCustomWidget({
      name: 'extra',
      type: 'text',
      value: 'hello'
    } as IBaseWidget)

    const captured = serializeWithCapture(host)
    const proof = proveAgainstCoreSitePayload(host, captured)

    // What the form would claim, against what the payload finally holds.
    expect(proof.order).toEqual(['alpha', 'extra'])
    expect(captured.final.widgets_values).toEqual([1])

    expect(proof.provable).toBe(false)
  })
})
