import { useExtensionService } from '@/services/extensionService'
import { useLivePreview } from '@/composables/useLivePreview'

const { setupLivePreviewNode } = useLivePreview()

useExtensionService().registerExtension({
  name: 'Comfy.StringLength',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name === 'StringLength') {
      const onNodeCreated = nodeType.prototype.onNodeCreated
      nodeType.prototype.onNodeCreated = function () {
        if (onNodeCreated) {
          onNodeCreated.call(this)
        }

        // Set up live preview with calculator
        setupLivePreviewNode(this, {
          calculator: (inputs) => {
            const inputString = inputs[0]
            if (inputString == null) return undefined
            return String(inputString).length
          },
          propagationOptions: {
            updateWidget: true,
            callOnExecuted: true
          }
        })
      }
    }
  }
})

useExtensionService().registerExtension({
  name: 'Comfy.StringConcatenate',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name === 'StringConcatenate') {
      const onNodeCreated = nodeType.prototype.onNodeCreated
      nodeType.prototype.onNodeCreated = function () {
        if (onNodeCreated) {
          onNodeCreated.call(this)
        }

        // Set up live preview with calculator
        setupLivePreviewNode(this, {
          calculator: (inputs) => {
            const [string_a, string_b, delimiter] = inputs
            if (string_a == null && string_b == null) return undefined
            return [string_a ?? '', string_b ?? ''].join(delimiter || '')
          },
          propagationOptions: {
            updateWidget: true,
            callOnExecuted: true
          }
        })
      }
    }
  }
})