import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useLitegraphService } from '@/services/litegraphService'
import { app } from '@/scripts/app'

app.registerExtension({
  name: 'Comfy.CustomCombo',
  registerCustomNodes() {
    const { addNodeInput } = useLitegraphService()
    class SwitchNode extends LGraphNode {
      constructor(title?: string) {
        super(title ?? 'Custom Combo')
        if (!this.properties) {
          this.properties = {}
        }
        this.addWidget('combo', 'choice', 0, () => {})
        Object.defineProperty(this.widgets![0].options, 'values', {
          get: () => {
            return this.widgets!.filter(
              (w) => w.name.startsWith('option') && w.value
            ).map((w) => w.value)
          }
        })
        this.addOutput('output', 'string')
        addNodeInput(this, {
          //TODO: import constant?
          type: 'COMFY_AUTOGROW_V3',
          name: 'options',
          isOptional: false,
          template: {
            prefix: 'option',
            input: {
              required: {
                option: ['STRING', { socketless: true }]
              }
            }
          }
        })
        // This node is purely frontend and does not impact the resulting prompt so should not be serialized
        this.isVirtualNode = true
      }
    }
    LiteGraph.registerNodeType(
      'CustomCombo',
      Object.assign(SwitchNode, {
        title: 'Custom Combo'
      })
    )
  }
})
