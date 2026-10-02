import type { UseCase } from '../../config/models-catalogue'

export type HubDoor = 'apps' | 'workflows' | 'models'

/** Clean, text-free stills that front each task on the Hub landing. */
export const TASK_ART: Partial<Record<UseCase, string>> = {
  'generate-images':
    'https://comfy-hub-assets.comfy.org/uploads/84ef630e-8594-4c0f-a163-488b4bac6941.png',
  'edit-images':
    'https://media.comfy.org/website/workshop/luma_2/uni-1-max-image-edit/foggy-pier-turned-sunny.png',
  'generate-videos': '/images/cinematic-studio/bus-stop.jpg',
  'animate-images':
    'https://cloud.comfy.org/templates/video_ltx2_3_flf2v-1.webp',
  'edit-videos':
    'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/api_runway_aleph2_video_edit-1.webp',
  audio:
    'https://media.comfy.org/website/workshop/heygen/starfish-tts/harbour-radio-signs-off.png'
}

/** Candidates for each section card's stack, best first. */
export const DOOR_ART: Readonly<Record<HubDoor, readonly string[]>> = {
  apps: [
    '/images/cinematic-studio/desert.jpg',
    '/images/cinematic-studio/diner.jpg',
    '/images/cinematic-studio/motel.jpg',
    '/images/cinematic-studio/letter.jpg'
  ],
  workflows: [
    'https://cloud.comfy.org/templates/templates-product_scene_relight-1.webp',
    'https://cloud.comfy.org/templates/flux_fill_outpaint_example-1.webp',
    'https://cloud.comfy.org/templates/utility_hitpaw_general_image_enhance-1.webp',
    'https://media.comfy.org/website/workshop/workflows/character-turnaround/pink-silver-character-sheet-thumb.webp',
    'https://cloud.comfy.org/templates/flux_fill_inpaint_example-1.webp'
  ],
  models: [
    'https://media.comfy.org/website/workshop/vertexai/gemini-3-pro-image/alpine-lake-at-blue-hour.png',
    'https://media.comfy.org/website/workshop/runway/gen4-image/rowboat-on-a-tropical-lagoon.png',
    'https://media.comfy.org/website/workshop/recraft/v4-pro-text-to-image/rooftop-fashion-at-golden-hour.png',
    'https://media.comfy.org/website/workshop/luma/photon-1-image-generation/reading-on-the-train-same-film-look.png',
    'https://media.comfy.org/website/workshop/krea/krea-2-medium-turbo/character-concept-courier-robot-v3.png'
  ]
}
