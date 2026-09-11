import defaultMedia from '../data/router-default-media.json'
import type { WorkshopModelDetail } from './models-catalogue'
import type { RouterRenderParameters } from './router-parameters'
import { mapRouterParameters } from './router-parameters'
import type { FieldSchema, FormValues } from './workshop-playground'

const templateInputs =
  'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@aaac56dd5cc5497533d92cbe50edc35ea660e587/input/'
const image = `${templateInputs}denim_girl.png`
const portrait =
  'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@1e272b544243e539b182da4ac26b6616224716f2/input/close_up_portrait.png'
const video = `${templateInputs}lighter.mp4`
const audio = 'https://assets.sync.so/docs/example-audio.wav'
const sourceImage = { source_images: [image] }
const sourceVideo = { source_videos: [video] }
const maskedImage = {
  source_images: [`data:image/png;base64,${defaultMedia.image}`],
  mask_image: `data:image/png;base64,${defaultMedia.mask}`
}
const videoPrompt =
  'Generate a short video of a red fox walking through a sunlit forest. The camera follows smoothly as leaves move in the breeze.'
const videoEditPrompt =
  'Turn this video into a colorful animated scene. Keep the original motion and camera framing.'
const robotInputs =
  'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@f331af10934fdf0d773d5f26c1d00f33559ae09d/input/'
const robotFirstFrame = `${robotInputs}pink_robot_front.png`
const robotLastFrame = `${robotInputs}pink_robot_back.png`
const robotTurn: RouterRenderParameters = {
  prompt:
    'The pink toy robot smoothly turns from the front view in the first frame to the back view in the last frame. Keep its design and the warm orange studio background consistent.',
  first_frame: robotFirstFrame,
  last_frame: robotLastFrame,
  duration_seconds: 5
}
const pageDefaults: Readonly<Partial<Record<string, RouterRenderParameters>>> =
  {
    'byteplus--seedance-2-5-first-last-frame--animate-images': robotTurn,
    'byteplus--seedance-2-fast-first-last-frame--animate-images': robotTurn,
    'byteplus--seedance-2-fast-reference--generate-videos': {
      prompt:
        'The pink toy robot from the reference image performs a cheerful dance in a warm orange studio. Keep its design and colors consistent as it waves and takes a small step.',
      reference_images: [robotFirstFrame],
      duration_seconds: 5
    },
    'kling--lip-sync-text-to-video--edit-videos': {
      prompt:
        'Welcome to Comfy Cloud. Let us bring your creative ideas to life today.',
      source_videos: ['https://assets.sync.so/docs/example-video.mp4']
    }
  }

const defaults: Readonly<Partial<Record<string, RouterRenderParameters>>> = {
  'beeble--switchx-image-edit--edit-images': {
    model_specific: { source_uri: image }
  },
  'beeble--switchx-video-edit--edit-videos': {
    model_specific: { source_uri: video }
  },
  'bfl--flux-3-image-to-video--animate-images': sourceImage,
  'bfl--flux-3-video-continuation--edit-videos': sourceVideo,
  'bfl--flux-erase--edit-images': maskedImage,
  'bfl--flux-pro-expand--edit-images': {
    source_images: [`data:image/png;base64,${defaultMedia.image}`]
  },
  'bfl--flux-pro-fill--edit-images': {
    source_images: [`data:image/png;base64,${defaultMedia.image}`],
    mask_image: `data:image/png;base64,${defaultMedia.mask}`
  },
  'bfl--flux-virtual-try-on--edit-images': {
    source_images: [image],
    reference_images: [`${templateInputs}black_coat_model.png`]
  },
  'bria--eraser--edit-images': maskedImage,
  'bria--expand-image--edit-images': sourceImage,
  'bria--generative-fill--edit-images': {
    ...maskedImage,
    mask_image: `data:image/png;base64,${defaultMedia.partialMask}`
  },
  'bria--remove-video-background--edit-videos': sourceVideo,
  'byteplus--seedance-1-0-lite-first-last-frame--animate-images': {
    first_frame: image
  },
  'byteplus--seedance-1-0-lite-image-reference--animate-images': {
    reference_images: [image]
  },
  'byteplus--seedance-1-0-lite-image-to-video--animate-images': {
    first_frame: image
  },
  'freepik--magnific-skin-enhancer--edit-images': {
    source_images: [portrait]
  },
  'freepik--magnific-upscaler-precise-v2--edit-images': sourceImage,
  'gemini--omni-1.1-flash--animate-images': sourceImage,
  'gemini--omni-1.1-flash--edit-videos': sourceVideo,
  'gemini--omni-flash-preview--animate-images': sourceImage,
  'gemini--omni-flash-preview--edit-videos': sourceVideo,
  'heygen--starfish-tts--audio': {
    model_specific: { voice_id: 'd2f4f24783d04e22ab49ee8fdc3715e0' }
  },
  'kling--avatar--animate-images': {
    source_images: [portrait],
    source_audio: [audio]
  },
  'kling--camera-control-image-to-video--animate-images': sourceImage,
  'kling--lip-sync-audio-to-video--edit-videos': {
    source_videos: ['https://assets.sync.so/docs/example-video.mp4'],
    source_audio: [audio]
  },
  'luma--photon-1-image-modify--edit-images': sourceImage,
  'runway--gen4-turbo-image-to-video--animate-images': sourceImage,
  'vertexai--veo-3--animate-images': { first_frame: image },
  'wan--happyhorse-image-to-video--animate-images': sourceImage,
  'wan--happyhorse-video-edit--edit-videos': sourceVideo,
  'wan--image-to-video--animate-images': sourceImage,
  'wan--reference-to-video-3.0-prime--animate-images': sourceImage,
  'wan--reference-video--edit-videos': sourceVideo,
  'wan--video-continuation-2.7--animate-images': sourceImage,
  'wan--video-edit-2.7--edit-videos': sourceVideo,
  'wavespeed--flashvsr--edit-videos': { duration_seconds: 10 },
  'wavespeed--seedvr2-image--edit-images': sourceImage,
  'wavespeed--ultimate-image-upscaler--edit-images': sourceImage,
  'xai--grok-imagine-video-1.5--animate-images': sourceImage
}

function repairedValues(
  model: WorkshopModelDetail,
  values: FormValues
): FormValues {
  const request = model.execution?.creator?.request
  const example = model.execution?.inputSchema.example
  if (
    request?.kind === 'callback' &&
    request.callback === 'gemini-video' &&
    example !== null &&
    typeof example === 'object' &&
    !Array.isArray(example) &&
    typeof example.input === 'string' &&
    values.input === example.input
  )
    return {
      ...values,
      input: request.options.mode === 'edit' ? videoEditPrompt : videoPrompt
    }
  if (
    model.slug === 'bfl--flux-pro-expand--edit-images' &&
    ['top', 'bottom', 'left', 'right'].every((name) => values[name] === 0)
  )
    return { ...values, top: 64 }
  return values
}

export function applyRouterDefaultInputs(
  model: WorkshopModelDetail,
  schema: readonly FieldSchema[],
  values: FormValues
): FormValues {
  const repaired = repairedValues(model, values)
  const authored = pageDefaults[model.slug]
  if (authored) return mapRouterParameters(schema, repaired, authored)
  const parameters = defaults[model.slug]
  if (!parameters) return repaired
  const mapped = mapRouterParameters(schema, repaired, parameters)
  return {
    ...repaired,
    ...Object.fromEntries(
      Object.entries(mapped).filter(
        ([name]) => repaired[name] === undefined || repaired[name] === ''
      )
    )
  }
}
