/**
 * NoteNode + MarkdownNoteNode — rewritten with the v2 extension API.
 *
 * v1 used `registerCustomNodes` to call `LiteGraph.registerNodeType()` directly.
 * v2 does NOT yet have a `registerNodeType` hook on `defineExtension`. The
 * custom-node-type registration surface is a planned addition (gap tracked in
 * the inline comment below).
 *
 * What this file demonstrates to Simon/Austin:
 *  1. Pure app-level extensions use `defineExtension({ setup() })`.
 *  2. Shell settings are accessed via the `ExtensionManager` passed to `setup`.
 *  3. Custom LiteGraph node type registration has NO v2 equivalent yet.
 *     The v2 API surface covers node *instance* hooks (nodeCreated, executed,
 *     etc.) but not node *type* registration, which today still requires
 *     LiteGraph.registerNodeType(). That gap will be addressed in PKG4 /
 *     the ComfyNodeRegistry design.
 *
 * Compare with noteNode.ts (v1):
 *   v1: registerCustomNodes() callback, direct LiteGraph + ComfyWidgets calls
 *   v2: setup() callback, custom-node-type registration still needs v1 bridge
 *
 * API GAPS (feedback items for Simon/Austin):
 *  GAP-1: No `registerNodeTypes` hook on `ExtensionOptions` — can't replace
 *         `registerCustomNodes` in pure v2. Need a `NodeTypeRegistry` surface
 *         or a first-class "custom node type" abstraction in the v2 API.
 *  GAP-2: No `addWidget` for node *type* construction time (before any
 *         instance exists) — `ComfyWidgets.STRING(this, ...)` has no analog.
 *  GAP-3: Node colour + visual styling (`this.color`, `this.bgcolor`,
 *         `this.groupcolor`) has no API surface; would need NodeHandle setter.
 *
 * Interim bridge: call LiteGraph directly inside `setup()` to register the
 * types, then rely on `defineNodeExtension({ nodeTypes: ['Note'] })` for any
 * per-instance extension logic. This hybrid is the least-bad option until
 * GAP-1 is closed.
 */

import { LGraphCanvas, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { ComfyWidgets } from '../../scripts/widgets'
import { defineExtension } from '@/extension-api'

// ── GAP-1: Interim bridge for custom node type registration ──────────────────
// We still call LiteGraph.registerNodeType() directly because there is no v2
// `registerNodeTypes` hook. This is intentionally non-ideal — the explicit goal
// is to surface this gap for the Simon/Austin design discussion.

function registerNoteTypes() {
  class NoteNode extends LGraphNode {
    static override category: string
    static collapsable: boolean
    static title_mode: number

    groupcolor = LGraphCanvas.node_colors.yellow.groupcolor
    override isVirtualNode: boolean

    constructor(title: string) {
      super(title)
      // GAP-3: node colour should be settable via NodeHandle in nodeCreated.
      this.color = LGraphCanvas.node_colors.yellow.color
      this.bgcolor = LGraphCanvas.node_colors.yellow.bgcolor
      if (!this.properties) this.properties = { text: '' }
      // GAP-2: no v2 analog for widget addition at type-construction time.
      ComfyWidgets.STRING(
        this,
        'text',
        ['STRING', { default: this.properties.text, multiline: true }],
        // @ts-expect-error app not available at this layer
        undefined
      )
      this.serialize_widgets = true
      this.isVirtualNode = true
    }
  }

  LiteGraph.registerNodeType(
    'Note',
    Object.assign(NoteNode, {
      title_mode: LiteGraph.NORMAL_TITLE,
      title: 'Note',
      collapsable: true
    })
  )
  NoteNode.category = 'utils'

  class MarkdownNoteNode extends LGraphNode {
    static override title = 'Markdown Note'
    groupcolor = LGraphCanvas.node_colors.yellow.groupcolor

    constructor(title: string) {
      super(title)
      this.color = LGraphCanvas.node_colors.yellow.color
      this.bgcolor = LGraphCanvas.node_colors.yellow.bgcolor
      if (!this.properties) this.properties = { text: '' }
      ComfyWidgets.MARKDOWN(
        this,
        'text',
        ['STRING', { default: this.properties.text }],
        // @ts-expect-error app not available at this layer
        undefined
      )
      this.serialize_widgets = true
      this.isVirtualNode = true
    }
  }

  LiteGraph.registerNodeType('MarkdownNote', MarkdownNoteNode)
  MarkdownNoteNode.category = 'utils'
}

// ── v2 registration ──────────────────────────────────────────────────────────

defineExtension({
  name: 'Comfy.NoteNode.V2',

  setup() {
    // GAP-1: Custom node types must be registered here via LiteGraph directly.
    // In the intended v2 design this would be a `registerNodeTypes(registry)`
    // hook on ExtensionOptions where `registry.add('Note', NoteNodeDef)`.
    registerNoteTypes()
  }
})
