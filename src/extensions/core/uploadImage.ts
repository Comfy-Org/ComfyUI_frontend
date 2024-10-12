// @ts-strict-ignore
import { app } from '../../scripts/app'
import { ComfyNodeDef } from '@/types/apiTypes'

// Adds an upload button to the nodes

app.registerExtension({
  name: 'Comfy.UploadImage',
  async beforeRegisterNodeDef(nodeType, nodeData: ComfyNodeDef, app) {
    if (nodeData?.input?.required?.image?.[1]?.image_upload === true) {
      nodeData.input.required.upload = ['IMAGEUPLOAD']
    }
  }
})
