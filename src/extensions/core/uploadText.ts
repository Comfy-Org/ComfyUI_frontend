import {
  ComfyNodeDef,
  InputSpec,
  isComboInputSpecV1
} from '@/schemas/nodeDefSchema'

import { app } from '../../scripts/app'

// Adds an upload button to text/pdf nodes

const isTextUploadComboInput = (inputSpec: InputSpec) => {
  const [inputName, inputOptions] = inputSpec
  if (!inputOptions) return false

  const isUploadInput = inputOptions['text_upload'] === true

  return (
    isUploadInput && (isComboInputSpecV1(inputSpec) || inputName === 'COMBO')
  )
}

const createUploadInput = (
  textInputName: string,
  textInputOptions: InputSpec
): InputSpec => [
  'TEXTUPLOAD',
  {
    ...textInputOptions[1],
    textInputName
  }
]

app.registerExtension({
  name: 'Comfy.UploadText',
  beforeRegisterNodeDef(_nodeType, nodeData: ComfyNodeDef) {
    const { input } = nodeData ?? {}
    const { required } = input ?? {}
    if (!required) return

    const found = Object.entries(required).find(([_, input]) =>
      isTextUploadComboInput(input)
    )

    // If text/pdf combo input found, attach upload input
    if (found) {
      const [inputName, inputSpec] = found
      required.upload = createUploadInput(inputName, inputSpec)
    }
  }
})
