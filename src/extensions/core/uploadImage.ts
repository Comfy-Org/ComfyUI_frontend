import { ComfyNodeDef, InputSpec, isComboInputSpecV1 } from '@/types/apiTypes'

import { app } from '../../scripts/app'

// Adds an upload button to the nodes

const isImageComboInput = (inputSpec: InputSpec) => {
  const [inputName, inputOptions] = inputSpec
  if (!inputOptions || inputOptions['image_upload'] !== true) return false
  return isComboInputSpecV1(inputSpec) || inputName === 'COMBO'
}

const createUploadInput = (
  imageInputName: string,
  imageInputOptions: InputSpec
): InputSpec => [
  'IMAGEUPLOAD',
  {
    ...imageInputOptions[1],
    imageInputName
  }
]

app.registerExtension({
  name: 'Comfy.UploadImage',
  beforeRegisterNodeDef(nodeType, nodeData: ComfyNodeDef) {
    const { input } = nodeData ?? {}
    const { required } = input ?? {}
    if (!required) return

    const found = Object.entries(required).find(([_, input]) =>
      isImageComboInput(input)
    )

    // If image combo input found, attach upload input
    if (found) {
      const [inputName, inputSpec] = found
      required.upload = createUploadInput(inputName, inputSpec)
    }
  }
})
