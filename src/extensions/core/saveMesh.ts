import { nextTick } from 'vue'

import Load3D from '@/components/load3d/Load3D.vue'
import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import { useExtensionService } from '@/services/extensionService'
import { useLoad3dService } from '@/services/load3dService'

useExtensionService().registerExtension({
  name: 'Comfy.SaveGLB',

  async beforeRegisterNodeDef(_nodeType, nodeData) {
    if ('SaveGLB' === nodeData.name) {
      // @ts-expect-error InputSpec is not typed correctly
      nodeData.input.required.image = ['PREVIEW_3D']
    }
  },

  getCustomWidgets() {
    return {
      PREVIEW_3D(node) {
        const inputSpec: CustomInputSpec = {
          name: 'image',
          type: 'Preview3D',
          isAnimation: false,
          isPreview: true
        }

        const widget = new ComponentWidgetImpl({
          node,
          name: inputSpec.name,
          component: Load3D,
          inputSpec,
          options: {}
        })

        addWidget(node, widget)

        return { widget }
      }
    }
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'SaveGLB') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 550)])

    await nextTick()

    const onExecuted = node.onExecuted

    node.onExecuted = function (message: any) {
      onExecuted?.apply(this, arguments as any)

      const fileInfo = message['3d'][0]

      const load3d = useLoad3dService().getLoad3d(node)

      const modelWidget = node.widgets?.find((w) => w.name === 'image')

      if (load3d && modelWidget) {
        const filePath = fileInfo['subfolder'] + '/' + fileInfo['filename']

        modelWidget.value = filePath

        const config = new Load3DConfiguration(load3d)

        config.configureForSaveMesh(fileInfo['type'], filePath)
      }
    }
  }
})
