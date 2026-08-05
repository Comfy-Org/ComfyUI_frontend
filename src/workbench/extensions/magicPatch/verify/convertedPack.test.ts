/**
 * Executes a real generated conversion against the real published API.
 *
 * The conformance harness cannot do this yet — for an agent-authored rewrite it
 * skips five of its seven checks, so a conversion can reference an API member
 * that does not exist and still be reported as passing. That happened: a draft
 * used a selector shape the registry does not accept, which silently never
 * matched. This test closes that hole for the packs it covers by running the
 * converted code and asserting the behaviour, not the text.
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  applyDefExtensions,
  resetComfyApi,
  useComfyApi
} from '@/platform/nodeApi/comfyApi'
import type { Comfy } from '@/platform/nodeApi/comfyApi'

const DISPLAY_ANY_DEF = {
  name: 'DisplayAny',
  display_name: 'Display Any',
  category: 'essentials/utilities',
  output: [],
  input: { required: {} }
}

/**
 * The generated conversion of comfyui_essentials `js/DisplayAny.js`, verbatim.
 * Kept as source text so a regeneration that drifts shows up as a diff here.
 */
function runConvertedPack(comfy: Comfy) {
  const DISPLAY_TEXT = 'displaytext'

  comfy.defs.extend('DisplayAny', (builder) => {
    if (!builder.def.category?.startsWith('essentials')) {
      return
    }

    builder.onExecuted((node, result) => {
      const kept = node.widgets.at(0)?.name
      for (const name of node.widgets.names()) {
        if (name !== kept) {
          node.widgets.remove(name)
        }
      }

      const textWidget =
        node.widgets.get(DISPLAY_TEXT) ??
        node.widgets.add({
          type: 'textarea',
          name: DISPLAY_TEXT,
          value: '',
          disabled: true
        })

      textWidget.value = result.text.join('')
    })
  })
}

describe('converted comfyui_essentials/DisplayAny', () => {
  let graph: LGraph
  let comfy: Comfy
  let node: LGraphNode

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()
    // The app-wide instance, because that is the one `applyDefExtensions`
    // resolves — a standalone instance would leave the extensions unapplied.
    resetComfyApi()
    comfy = useComfyApi(() => graph)
    runConvertedPack(comfy)

    class DisplayAny extends LGraphNode {
      constructor() {
        super('DisplayAny')
      }
    }
    // The same path the app uses, so the test exercises the real wiring rather
    // than reaching into the registry.
    applyDefExtensions(DisplayAny, DISPLAY_ANY_DEF)
    node = new DisplayAny()
    graph.add(node)
  })

  const execute = (text: string[]) => node.onExecuted?.({ text } as never)

  it('renders executed text into a widget', () => {
    execute(['hello ', 'world'])
    const widget = comfy.graph.node(String(node.id))!.widgets.get('displaytext')
    expect(widget?.value).toBe('hello world')
  })

  it('creates the readout as a disabled textarea', () => {
    execute(['x'])
    const widget = comfy.graph.node(String(node.id))!.widgets.get('displaytext')
    // The original faked this with inputEl.readOnly plus border and background
    // overrides; `disabled` is the published equivalent.
    expect(widget?.type).toBe('textarea')
    expect(widget?.disabled).toBe(true)
  })

  it('reuses the widget across executions instead of appending', () => {
    execute(['first'])
    execute(['second'])
    execute(['third'])

    const widgets = comfy.graph.node(String(node.id))!.widgets
    expect(widgets.names().filter((n) => n === 'displaytext')).toHaveLength(1)
    expect(widgets.get('displaytext')?.value).toBe('third')
  })

  it('clears stale widgets the node accumulated, keeping the first', () => {
    const handle = comfy.graph.node(String(node.id))!
    handle.widgets.add({ type: 'string', name: 'keep_me', value: 'a' })
    handle.widgets.add({ type: 'string', name: 'stale', value: 'b' })

    execute(['done'])

    // Mirrors the original's `widgets.length = 1`: index 0 survives, the rest
    // are dropped — but through remove(), which runs each widget's teardown.
    expect(handle.widgets.names()).toEqual(['keep_me', 'displaytext'])
  })

  it('does not fire for a node outside the essentials category', () => {
    class Other extends LGraphNode {
      constructor() {
        super('DisplayAny')
      }
    }
    applyDefExtensions(Other, { ...DISPLAY_ANY_DEF, category: 'other/thing' })
    const other = new Other()
    graph.add(other)
    other.onExecuted?.({ text: ['nope'] } as never)

    expect(
      comfy.graph.node(String(other.id))!.widgets.get('displaytext')
    ).toBeUndefined()
  })
})
