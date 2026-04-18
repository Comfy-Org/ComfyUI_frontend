import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  type ComfyNodeDef,
  type InputSpec,
  isComboInputSpec,
  isMediaUploadComboInput
} from '@/schemas/nodeDefSchema'

import { app } from '../../scripts/app'

// Adds an upload button to the nodes

// Cloud's backend may serve these loader nodes without the image_upload /
// video_upload / animated_image_upload flag. Without a fallback the IMAGEUPLOAD
// widget is never attached, so node.pasteFiles stays unset and the right-click
// "Paste Image" menu item never appears on cloud LoadImage nodes.
const KNOWN_MEDIA_LOADER_INPUTS: Record<string, string> = {
  LoadImage: 'image',
  LoadImageMask: 'image',
  LoadVideo: 'file',
  LoadAudio: 'audio'
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
  beforeRegisterNodeDef(_nodeType: typeof LGraphNode, nodeData: ComfyNodeDef) {
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
      return
    }

    const fallbackInputName = KNOWN_MEDIA_LOADER_INPUTS[nodeData?.name ?? '']
    if (!fallbackInputName) return
    const fallbackSpec = required[fallbackInputName] as InputSpec | undefined
    if (!fallbackSpec || !isComboInputSpec(fallbackSpec)) return
    required.upload = createUploadInput(fallbackInputName, fallbackSpec)
  }
})
