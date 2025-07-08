import {
  ComfyNodeDef,
  InputSpec,
  isComboInputSpecV1
} from '@/schemas/nodeDefSchema'

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

const ALLOWED_UPLOAD_KEYS = new Set([
  'image_upload',
  'video_upload',
  'animated_image_upload',
  'display_name',
  'control_after_generate',
  'allow_batch',
  'image_folder'
])

const createUploadInput = (
  imageInputName: string,
  imageInputSpec: InputSpec
): InputSpec => {
  const [, opts] = imageInputSpec

  // retain only the flags that make sense for IMAGEUPLOAD
  const cleanOpts = Object.fromEntries(
    Object.entries(opts ?? {}).filter(([k]) => ALLOWED_UPLOAD_KEYS.has(k))
  )

  return [
    'IMAGEUPLOAD',
    {
      ...cleanOpts,
      imageInputName
    }
  ]
}

app.registerExtension({
  name: 'Comfy.UploadImage',
  beforeRegisterNodeDef(_nodeType, nodeData: ComfyNodeDef) {
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
