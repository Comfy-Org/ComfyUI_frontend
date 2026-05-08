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
// video_upload flag on their media input. Without a fallback the IMAGEUPLOAD
// widget is never attached, so node.pasteFiles stays unset and the right-click
// "Paste Image" menu item never appears on cloud LoadImage nodes.
//
// LoadAudio is intentionally excluded — audio uses a separate AUDIOUPLOAD
// widget owned by Comfy.UploadAudio. Routing audio through IMAGEUPLOAD would
// reject every audio file the user pasted or dropped.
const FALLBACK_MEDIA_LOADER_INPUTS: Record<
  string,
  { inputName: string; flag: 'image_upload' | 'video_upload' }
> = {
  LoadImage: { inputName: 'image', flag: 'image_upload' },
  LoadVideo: { inputName: 'file', flag: 'video_upload' }
}

const createUploadInput = (
  imageInputName: string,
  imageInputOptions: InputSpec,
  extraOptions: Record<string, unknown> = {}
): InputSpec => [
  'IMAGEUPLOAD',
  {
    ...imageInputOptions[1],
    ...extraOptions,
    imageInputName
  }
]

app.registerExtension({
  name: 'Comfy.UploadImage',
  beforeRegisterNodeDef(_nodeType: typeof LGraphNode, nodeData: ComfyNodeDef) {
    const { input } = nodeData ?? {}
    const { required } = input ?? {}
    if (!required) return
    // Don't clobber a sibling uploader (e.g. Comfy.UploadAudio's AUDIOUPLOAD).
    if (required.upload) return

    const found = Object.entries(required).find(([_, input]) =>
      isMediaUploadComboInput(input)
    )

    // If media combo input found, attach upload input
    if (found) {
      const [inputName, inputSpec] = found
      required.upload = createUploadInput(inputName, inputSpec)
      return
    }

    const fallback = FALLBACK_MEDIA_LOADER_INPUTS[nodeData.name]
    if (!fallback) return
    const fallbackSpec = required[fallback.inputName]
    if (!fallbackSpec || !isComboInputSpec(fallbackSpec)) return
    // Synthesize the missing media-type flag so useImageUploadWidget picks the
    // right accept filter (image/* vs video/*) for the loader's media kind.
    required.upload = createUploadInput(fallback.inputName, fallbackSpec, {
      [fallback.flag]: true
    })
  }
})
