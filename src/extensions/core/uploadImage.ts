import {
  ComfyNodeDef,
  InputSpec,
  isComboInputSpecV1
} from '@/schemas/nodeDefSchema'

// NOTE: This extension should always register. In Vue Nodes mode,
// the legacy IMAGEUPLOAD widget will be ignored by the Vue renderer.

import { app } from '../../scripts/app'

// Adds an upload button to the nodes

const isMediaUploadComboInput = (inputSpec: InputSpec) => {
  const [inputName, inputOptions] = inputSpec
  if (!inputOptions) return false

  const isUploadInput =
    inputOptions['image_upload'] === true ||
    inputOptions['video_upload'] === true ||
    inputOptions['animated_image_upload'] === true

  return (
    isUploadInput && (isComboInputSpecV1(inputSpec) || inputName === 'COMBO')
  )
}

const createUploadInput = (
  imageInputName: string,
  imageInputOptions: InputSpec
): InputSpec => [
  'IMAGEUPLOAD',
  {
    ...imageInputOptions[1],
    imageInputName,
    // Ensure this legacy widget is not rendered by Vue Nodes
    canvasOnly: true
  }
]

app.registerExtension({
  name: 'Comfy.UploadImage',
  beforeRegisterNodeDef(_nodeType, nodeData: ComfyNodeDef) {
    // Always inject legacy IMAGEUPLOAD button for canvas mode.
    // In Vue Nodes mode, NodeWidgets.vue skips rendering IMAGEUPLOAD,
    // so this remains a no-op for the Vue renderer.
    const { input } = nodeData ?? {}
    const { required } = input ?? {}
    if (!required) return

    const found = Object.entries(required).find(([_, input]) =>
      isMediaUploadComboInput(input)
    )

    // If media combo input found, attach upload input
    if (found) {
      const [inputName, inputSpec] = found
      required.upload = createUploadInput(inputName, inputSpec)
    }
  }
})
