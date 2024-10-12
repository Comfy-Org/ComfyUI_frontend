// @ts-strict-ignore
import { LiteGraph, LGraphCanvas } from '@comfyorg/litegraph'
import { app } from '../../scripts/app'
import { ComfyWidgets } from '../../scripts/widgets'
import { LGraphNode } from '@comfyorg/litegraph'
// Node that add notes to your project

app.registerExtension({
  name: 'Comfy.NoteNode',
  registerCustomNodes() {
    class NoteNode extends LGraphNode {
      static category: string

      color = LGraphCanvas.node_colors.yellow.color
      bgcolor = LGraphCanvas.node_colors.yellow.bgcolor
      groupcolor = LGraphCanvas.node_colors.yellow.groupcolor
      isVirtualNode: boolean
      collapsable: boolean
      title_mode: number

      constructor(title?: string) {
        super(title)
        if (!this.properties) {
          this.properties = { text: '' }
        }
        ComfyWidgets.STRING(
          // Should we extends LGraphNode?  Yesss
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
      Object.assign(NoteNode, {
        title_mode: LiteGraph.NORMAL_TITLE,
        title: 'Note',
        collapsable: true
      })
    )

    NoteNode.category = 'utils'
  }
})
