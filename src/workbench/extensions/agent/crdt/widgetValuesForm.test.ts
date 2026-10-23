import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setAssertReporter } from '@/base/assert'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { reportError } from '@/platform/telemetry/reportError'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import {
  classifyWidgetValuesForm,
  provenWidgetValuesForm,
  resetWidgetFormSuppressionTally,
  widgetFormSuppressionTally,
  widgetValuesFormVerdict
} from './widgetValuesForm'

vi.mock(import('@/platform/telemetry/reportError'))

function nodeDef(
  name: string,
  required: NonNullable<ComfyNodeDefV1['input']>['required']
): ComfyNodeDefV1 {
  return {
    name,
    display_name: name,
    category: 'test',
    python_module: 'custom_nodes.test',
    description: '',
    input: { required },
    output: [],
    output_name: [],
    output_is_list: [],
    output_node: false
  }
}

function nodeWith(type: string, build: (node: LGraphNode) => void): LGraphNode {
  const node = detachedNodeWith(type, build)
  new LGraph().add(node)
  return node
}

/**
 * Graph registration collapses two widgets that share a name, so a node that
 * carries the duplicate has to be built outside a graph.
 */
function detachedNodeWith(
  type: string,
  build: (node: LGraphNode) => void
): LGraphNode {
  const node = new LGraphNode(type, type)
  node.serialize_widgets = true
  build(node)
  return node
}

/** The post-hook serialization, as `wireNodeSnapshot` reads it. */
function serializedOf(node: LGraphNode): ISerialisedNode {
  return node.serialize()
}

beforeEach(() => {
  resetWidgetFormSuppressionTally()
  useNodeDefStore().updateNodeDefs([])
})

describe('the proven widget form', () => {
  it('declares the live order for a node nothing interfered with', () => {
    const node = nodeWith('Plain', (n) => {
      n.addWidget('number', 'steps', 20, () => {})
      n.addWidget('text', 'prompt', 'hello', () => {})
    })

    expect(widgetValuesFormVerdict(node)).toEqual({
      declared: true,
      form: { order: ['steps', 'prompt'] }
    })
    expect(widgetFormSuppressionTally()).toEqual([])
  })

  it('declares nothing for a value-dependent layout, which the catalog owns', () => {
    useNodeDefStore().addNodeDef(
      nodeDef('Dynamic', { mode: ['COMFY_DYNAMICCOMBO_V3', {}] })
    )
    const node = nodeWith('Dynamic', (n) => {
      n.addWidget('combo', 'mode', 'a', () => {}, { values: ['a'] })
      n.addWidget('number', 'mode.steps', 4, () => {})
    })

    expect(widgetValuesFormVerdict(node)).toMatchObject({
      declared: false,
      reason: 'value_dependent_layout'
    })
  })

  it('declares nothing for a missing-node shell that round-trips a stored payload', () => {
    const node = nodeWith('Uninstalled', (n) => {
      n.addWidget('text', 'UNKNOWN', 'fabricated', () => {})
    })
    node.last_serialization = fromPartial<ISerialisedNode>({
      id: 1,
      type: 'Uninstalled',
      widgets_values: ['real value'],
      widgets_values_named: { real_name: 'real value' }
    })

    expect(widgetValuesFormVerdict(node)).toMatchObject({
      declared: false,
      reason: 'shell_last_serialization'
    })
  })
})

describe('invariant 4 — the form survived the extension serialize hook', () => {
  it('declares nothing when the hook adds a value core refused to serialise', () => {
    // The VideoHelperSuite shape: the pack keys its own dict from the
    // UNFILTERED widget list, so its keys and a derived order differ by
    // exactly the widget carrying `serialize = false`.
    const node = nodeWith('VHS_Probe', (n) => {
      n.addWidget('text', 'filename', 'clip', () => {})
      const hidden = n.addWidget('text', 'vhslatentpreview', 'x', () => {})
      hidden.serialize = false
      n.onSerialize = (data: ISerialisedNode) => {
        data.widgets_values_named = {
          ...data.widgets_values_named,
          vhslatentpreview: 'x'
        }
      }
    })

    expect(widgetValuesFormVerdict(node)).toMatchObject({
      declared: false,
      reason: 'hook_changed_serialized_widgets'
    })
  })

  it('declares nothing when the hook drops a widget mid-serialization', () => {
    const node = nodeWith('Shrinking', (n) => {
      n.addWidget('text', 'prompt', 'a', () => {})
      n.addWidget('text', 'extra', 'b', () => {})
      n.onSerialize = () => {
        n.widgets?.pop()
      }
    })

    expect(widgetValuesFormVerdict(node)).toMatchObject({
      declared: false,
      reason: 'hook_changed_serialized_widgets'
    })
  })

  it('still declares a form when the hook only reorders the named keys', () => {
    // Key order inside `widgets_values_named` is not meaningful — an
    // integer-like name is enumeration-reordered by the object itself, which
    // is the reason the form exists. Comparing sequences here would refuse a
    // pack that broke nothing.
    const node = nodeWith('Reordering', (n) => {
      n.addWidget('text', '2', 'two', () => {})
      n.addWidget('text', '1', 'one', () => {})
      n.onSerialize = (data: ISerialisedNode) => {
        data.widgets_values_named = { '1': 'one', '2': 'two' }
      }
    })

    expect(widgetValuesFormVerdict(node)).toEqual({
      declared: true,
      form: { order: ['2', '1'] }
    })
  })
})

describe('invariant 2 — the post-hook positional array still fits the widgets', () => {
  it('declares nothing when the hook rewrites widgets_values to a shorter array', () => {
    const node = nodeWith('Rewriting', (n) => {
      n.addWidget('text', 'prompt', 'a', () => {})
      n.addWidget('text', 'extra', 'b', () => {})
      n.onSerialize = (data: ISerialisedNode) => {
        data.widgets_values = ['only one']
      }
    })

    expect(widgetValuesFormVerdict(node)).toMatchObject({
      declared: false,
      reason: 'positional_arity_disagrees',
      detail: { positional: 1, serialised: 2 }
    })
  })

  it('counts button widgets, which core serialises and the wire drops', () => {
    // A button is serialised positionally but is not a document value, so a
    // check written against the value count would refuse every node with one.
    const node = nodeWith('Buttoned', (n) => {
      n.addWidget('text', 'prompt', 'a', () => {})
      n.addWidget('button', 'refresh', 'refresh', () => {})
    })

    expect(widgetValuesFormVerdict(node)).toEqual({
      declared: true,
      form: { order: ['prompt'] }
    })
  })
})

describe('invariants 1 and 3 — guards on the value filter', () => {
  // Neither is reachable through `valueWidgetsOnly` today: it drops a
  // `serialize: false` widget and derives the order from the same object it
  // filtered. Both are asserted against hand-built values, so the guard goes
  // red if a later change to that filter stops holding them.

  it('refuses an order entry naming a widget core would not serialise', () => {
    const node = nodeWith('Hiding', (n) => {
      n.addWidget('text', 'prompt', 'a', () => {})
      const hidden = n.addWidget('text', 'hidden', 'b', () => {})
      hidden.serialize = false
    })

    expect(
      classifyWidgetValuesForm(
        node,
        { prompt: 'a', hidden: 'b' },
        serializedOf(node)
      )
    ).toMatchObject({
      declared: false,
      reason: 'order_names_unserialized_widget',
      detail: { names: ['hidden'] }
    })
  })

  it('refuses an order entry whose value will not travel on the wire', () => {
    // `values` goes out as JSON, so only enumerable own keys arrive. An order
    // entry backed by a key `Object.hasOwn` can see and `Object.keys` cannot
    // would order a value the host never receives.
    const node = nodeWith('Residual', (n) => {
      n.addWidget('text', 'prompt', 'a', () => {})
      n.addWidget('text', 'residue', 'b', () => {})
    })
    const values: Record<string, unknown> = { prompt: 'a' }
    Object.defineProperty(values, 'residue', {
      value: 'b',
      enumerable: false
    })

    expect(
      classifyWidgetValuesForm(node, values, serializedOf(node))
    ).toMatchObject({
      declared: false,
      reason: 'declared_keys_disagree',
      detail: { unvalued: ['residue'] }
    })
  })
})

describe('the legitimate shapes a producer cannot describe', () => {
  it('reports a value whose widget is gone but whose store entry is not', () => {
    const node = nodeWith('Vanishing', (n) => {
      n.addWidget('text', 'prompt', 'a', () => {})
    })

    expect(
      classifyWidgetValuesForm(
        node,
        { prompt: 'a', vanished: 'b' },
        serializedOf(node)
      )
    ).toMatchObject({
      declared: false,
      reason: 'value_has_no_live_widget',
      detail: { names: ['vanished'] }
    })
  })

  it('reports an unnamed value widget', () => {
    const node = nodeWith('Unnamed', (n) => {
      n.addWidget('text', 'prompt', 'a', () => {})
      n.addWidget('text', '', 'b', () => {})
    })

    expect(widgetValuesFormVerdict(node)).toMatchObject({
      declared: false,
      reason: 'unnamed_value_widget'
    })
  })

  it('reports two value widgets sharing a name', () => {
    const node = detachedNodeWith('Duplicated', (n) => {
      n.addWidget('text', 'prompt', 'a', () => {})
      n.addWidget('text', 'prompt', 'b', () => {})
    })

    expect(widgetValuesFormVerdict(node)).toMatchObject({
      declared: false,
      reason: 'duplicate_widget_name'
    })
  })

  it('has nothing to declare for a node whose only widget is a button', () => {
    const node = nodeWith('OnlyButton', (n) => {
      n.addWidget('button', 'refresh', 'refresh', () => {})
    })

    expect(widgetValuesFormVerdict(node)).toMatchObject({
      declared: false,
      reason: 'no_value_widgets'
    })
  })
})

describe('the invariant channel', () => {
  it('routes a broken invariant through assert without stopping the mint', () => {
    const node = nodeWith('Rewriting', (n) => {
      n.addWidget('text', 'prompt', 'a', () => {})
      n.addWidget('text', 'extra', 'b', () => {})
      n.onSerialize = (data: ISerialisedNode) => {
        data.widgets_values = ['only one']
      }
    })
    const serialized = serializedOf(node)

    // The DEV throw is swallowed on purpose: a third-party pack must not be
    // able to stop the Agent minting in a developer's browser.
    expect(
      provenWidgetValuesForm(node, { prompt: 'a', extra: 'b' }, serialized)
    ).toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Agent widget form invariant 2')
    )
  })

  it('names the invariant and the ADR, and keeps values out of the message', () => {
    vi.stubEnv('DEV', false)
    const reporter = vi.fn()
    setAssertReporter(reporter)
    const node = nodeWith('Shrinking', (n) => {
      n.addWidget('text', 'prompt', 'a', () => {})
      n.addWidget('text', 'extra', 'b', () => {})
      n.onSerialize = () => {
        n.widgets?.pop()
      }
    })
    const serialized = serializedOf(node)

    provenWidgetValuesForm(node, { prompt: 'a' }, serialized)

    expect(reporter).toHaveBeenCalledWith(
      expect.stringContaining('Agent widget form invariant 4'),
      expect.objectContaining({ nodeType: 'Shrinking' })
    )
    const [message] = reporter.mock.calls[0] as [string]
    expect(message).toContain(
      'docs/adr/WIDGET-SERIALIZATION-0047-agent-wire-widget-form-is-proven-not-derived.md'
    )
    expect(message).not.toContain('Shrinking')
    setAssertReporter(null)
  })
})

describe('invariant 5 — the undeclared-form production signal', () => {
  it('reports the class and the reason, once per pair', () => {
    useNodeDefStore().addNodeDef(
      nodeDef('Dynamic', { mode: ['COMFY_DYNAMICCOMBO_V3', {}] })
    )
    const build = (n: LGraphNode) => {
      n.addWidget('combo', 'mode', 'a', () => {}, { values: ['a'] })
      n.addWidget('number', 'mode.steps', 4, () => {})
    }

    for (const node of [nodeWith('Dynamic', build), nodeWith('Dynamic', build)])
      provenWidgetValuesForm(
        node,
        { mode: 'a', 'mode.steps': 4 },
        serializedOf(node)
      )

    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'object-shaped widget values with no declared form'
        )
      }),
      expect.objectContaining({
        errorType: 'agent_widget_form_undeclared',
        surface: 'agent',
        level: 'warning',
        tags: { node_type: 'Dynamic', reason: 'value_dependent_layout' },
        fingerprint: [
          'agent_widget_form_undeclared',
          'value_dependent_layout',
          'Dynamic'
        ]
      })
    )
  })

  it('does not report a node that has nothing to declare', () => {
    const node = nodeWith('OnlyButton', (n) => {
      n.addWidget('button', 'refresh', 'refresh', () => {})
    })

    expect(provenWidgetValuesForm(node, {}, serializedOf(node))).toBeUndefined()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('keeps a per-class tally a bulk pass can read without telemetry', () => {
    useNodeDefStore().addNodeDef(
      nodeDef('Dynamic', { mode: ['COMFY_DYNAMICCOMBO_V3', {}] })
    )
    const dynamic = () =>
      nodeWith('Dynamic', (n) => {
        n.addWidget('combo', 'mode', 'a', () => {}, { values: ['a'] })
      })
    const duplicated = detachedNodeWith('Duplicated', (n) => {
      n.addWidget('text', 'prompt', 'a', () => {})
      n.addWidget('text', 'prompt', 'b', () => {})
    })

    for (const node of [dynamic(), dynamic()])
      provenWidgetValuesForm(node, { mode: 'a' }, serializedOf(node))
    provenWidgetValuesForm(
      duplicated,
      { prompt: 'b' },
      serializedOf(duplicated)
    )

    expect(widgetFormSuppressionTally()).toEqual([
      { nodeType: 'Dynamic', reason: 'value_dependent_layout', count: 2 },
      { nodeType: 'Duplicated', reason: 'duplicate_widget_name', count: 1 }
    ])
  })

  it('classifies for a bulk pass without reporting or tallying', () => {
    useNodeDefStore().addNodeDef(
      nodeDef('Dynamic', { mode: ['COMFY_DYNAMICCOMBO_V3', {}] })
    )
    const node = nodeWith('Dynamic', (n) => {
      n.addWidget('combo', 'mode', 'a', () => {}, { values: ['a'] })
    })

    expect(widgetValuesFormVerdict(node)).toMatchObject({ declared: false })
    expect(reportError).not.toHaveBeenCalled()
    expect(widgetFormSuppressionTally()).toEqual([])
  })
})
