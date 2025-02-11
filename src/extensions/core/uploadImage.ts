import { ComfyNodeDef, InputSpec } from '@/types/apiTypes'

import { app } from '../../scripts/app'

// Adds an upload button to the nodes

app.registerExtension({
  name: 'Comfy.UploadImage',
  beforeRegisterNodeDef(nodeType, nodeData: ComfyNodeDef) {
    // Check if there is a required input named 'image' in the nodeData
    const imageInputSpec: InputSpec | undefined =
      nodeData?.input?.required?.image

    // Get the config from the image input spec if it exists
    const config = imageInputSpec?.[1] ?? {}
    const { image_upload = false, image_folder = 'input' } = config

    if (image_upload && nodeData?.input?.required) {
      nodeData.input.required.upload = ['IMAGEUPLOAD', { image_folder }]
    }
  }
})
