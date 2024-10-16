import { app } from '../../scripts/app'
import { ComfyObjectInfo } from '@/types/comfy'

// Adds an upload button to the nodes

app.registerExtension({
  name: 'Comfy.UploadImage',
  async beforeRegisterNodeDef(nodeType, nodeData: ComfyObjectInfo, app) {
    if (nodeData.input?.required?.image?.[1]?.image_upload === true) {
      nodeData.input.required.upload = ['IMAGEUPLOAD']
    }
  }
})
