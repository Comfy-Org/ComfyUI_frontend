import { LiteGraph, LGraphCanvas } from '@comfyorg/litegraph'
import { app } from '../../scripts/app'
import { ComfyWidgets } from '../../scripts/widgets'
// Node that add notes to your project

app.registerExtension({
  name: 'Comfy.NoteNode',
  registerCustomNodes() {
    class NoteNode {
      static category: string

      color = LGraphCanvas.node_colors.yellow.color
      bgcolor = LGraphCanvas.node_colors.yellow.bgcolor
      groupcolor = LGraphCanvas.node_colors.yellow.groupcolor
      properties: { text: string }
      serialize_widgets: boolean
      isVirtualNode: boolean
      collapsable: boolean
      title_mode: number

      constructor() {
        if (!this.properties) {
          this.properties = { text: '' }
        }
        ComfyWidgets.STRING(
          // @ts-expect-error
          // Should we extends LGraphNode?
          this,
          '',
          ['', { default: this.properties.text, multiline: true }],
          app
        )

        this.serialize_widgets = true
        this.isVirtualNode = true
      }
    }

    // Load default visibility

    LiteGraph.registerNodeType(
      'Note',
      // @ts-expect-error
      Object.assign(NoteNode, {
        title_mode: LiteGraph.NORMAL_TITLE,
        title: 'Note',
        collapsable: true
      })
    )

    NoteNode.category = 'utils'
  }
})
