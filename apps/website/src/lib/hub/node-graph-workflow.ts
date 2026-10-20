import type { FaqItem } from '@/components/common/FAQSection.vue'
import type { PlaygroundExample } from '@/config/workshop-playground'

import type { NodeGraphInput } from './node-graph-inputs'

/** A Hub workflow that runs only in ComfyUI, never on its own page. */
export interface NodeGraphWorkflow {
  readonly slug: string
  readonly name: string
  readonly summary: string
  readonly description: readonly string[]
  readonly useCase?: { readonly label: string; readonly href: string }
  readonly graph: { readonly source: string; readonly previewUrl?: string }
  readonly downloadUrl: string
  /** The Cloud template that Try on Comfy Cloud opens. */
  readonly templateId: string
  /** Read from the graph's loader nodes when the page is built. */
  readonly inputs: readonly NodeGraphInput[]
  readonly models: readonly string[]
  readonly customNodes: readonly string[]
  readonly output?: string
  readonly author?: string
  readonly examples: readonly PlaygroundExample[]
  readonly faq: readonly FaqItem[]
}

const MEDIA =
  'https://media.comfy.org/website/workshop/workflows/character-turnaround'

/** Sample data for the node graph design preview. */
export const nodeGraphWorkflowSample: NodeGraphWorkflow = {
  slug: 'node-graph-preview',
  name: 'Create a character turnaround',
  summary:
    'Create multiple character views and close-ups from one reference image.',
  description: [
    'This workflow takes one picture of a character and builds a full turnaround sheet from it: front, half turn, side profile and back, plus a row of close-ups of the face. Each view keeps the outfit, colours and proportions of the reference, so the sheet is ready to hand to an animator or a 3D artist.',
    'It loads the reference with LoadImage, generates the full-body and close-up views in two branches, and stitches them into one sheet with ImageStitch. The graph uses custom nodes and models that are not available on this page, so it runs in ComfyUI: open it in Comfy Cloud, or download the JSON and drop it onto the canvas.'
  ],
  useCase: {
    label: 'Edit images',
    href: '/hub/workflows/?category=edit-images'
  },
  graph: {
    source: '/workflow-graphs/character-turnaround.json',
    previewUrl: '/workflow-graphs/character-turnaround.svg'
  },
  downloadUrl: '/workflow-graphs/character-turnaround.json',
  templateId: 'templates-character_sheet',
  inputs: [],
  models: ['Nano Banana Pro'],
  customNodes: ['ComfyUI-KJNodes', 'ComfyUI-Impact-Pack'],
  output: 'Image, 3 per run',
  author: 'ComfyUI',
  examples: [
    {
      id: 'pink-silver',
      title: 'Pink and silver character sheet',
      specs: [],
      values: {},
      outputUrl: `${MEDIA}/pink-silver-character-sheet.webp`,
      mediaKind: 'image',
      sampleOnly: true
    },
    {
      id: 'deep-sea-diver',
      title: 'Deep-sea diver character sheet',
      specs: [],
      values: {},
      outputUrl: `${MEDIA}/deep-sea-diver-sheet.webp`,
      mediaKind: 'image',
      sampleOnly: true
    },
    {
      id: 'space-courier',
      title: 'Animated space courier sheet',
      specs: [],
      values: {},
      outputUrl: `${MEDIA}/space-courier-sheet.webp`,
      mediaKind: 'image',
      sampleOnly: true
    }
  ],
  faq: [
    {
      question: 'What kind of reference image works best?',
      answer:
        'A full-body shot of one character on a plain background, facing the camera. Busy backgrounds and cropped limbs make the side and back views less consistent.'
    },
    {
      question: 'Can I change which views go on the sheet?',
      answer:
        'Yes. Each view is its own prompt in the graph, so you can edit, remove or add views before you run it.'
    },
    {
      question: 'Why does it need custom nodes?',
      answer:
        'The close-up crops and the final layout use nodes from ComfyUI-KJNodes and ComfyUI-Impact-Pack. Install them with ComfyUI Manager before you load the workflow.'
    },
    {
      question: 'How do I keep a character consistent across runs?',
      answer:
        'Fix the seed and reuse the same reference image. Changing only the prompt then changes the details without changing who the character is.'
    }
  ]
}

/** A second sample: core nodes only, a video output and an untitled image loader. */
export const nodeGraphFastH3Sample: NodeGraphWorkflow = {
  slug: 'node-graph-preview-fasth3',
  name: 'FastVideo FastH3: Image to Video',
  summary:
    'Generate video with synchronized native audio from a single still image using MiniMax H3 and the FastH3 8-step checkpoint.',
  description: [
    'This ComfyUI tutorial workflow turns a single still image into a short video with synchronized, auto-generated audio using the MiniMax H3 family via the FastVideo FastH3 8-Step V2 checkpoint. The pipeline is simple and fast: LoadImage reads your source, ImageScaleToTotalPixels (assisted by GetImageSize) rescales it to a GPU-friendly pixel budget while preserving aspect ratio, and the MiniMaxH3ImageToVideo node renders both video frames and a native audio track in one pass. SaveVideo then writes an MP4 output that includes the model’s audio when available.',
    'FastH3 8-Step V2 is a DMD2-distilled variant of MiniMax H3 that cuts inference to just 8 sampling steps, delivering much faster turnaround than the base model while maintaining audio/video synchronization. The workflow uses the minimax_h3_video_vae_fp16.safetensors VAE and the FastVideo/FastVideo-FastH3-8-Step-V2 checkpoint, giving you a practical, single-image-to-video path that’s ideal for animating portraits, product shots, and quick social clips without extra audio post-processing.'
  ],
  useCase: {
    label: 'Image to video',
    href: '/hub/workflows/?category=image-to-video'
  },
  graph: { source: '/workflow-graphs/fasth3-image-to-video.json' },
  downloadUrl: '/workflow-graphs/fasth3-image-to-video.json',
  templateId: '0edd9b3fffb3',
  inputs: [],
  models: ['FastVideo FastH3 8-Step V2', 'MiniMax H3 VAE'],
  customNodes: [],
  output: 'Video with audio, 1 per run',
  author: 'ComfyUI',
  examples: [
    {
      id: 'fasth3-goggles',
      title: 'Hooded figure with red-lens goggles',
      specs: [],
      values: {},
      outputUrl:
        'https://comfy-hub-assets.comfy.org/uploads/fb72c3f2-d4e2-4865-b7da-6a915c699510.mp4',
      mediaKind: 'video',
      sampleOnly: true
    }
  ],
  faq: [
    {
      question: 'What resolution should I use for best speed/quality?',
      answer:
        'Use ImageScaleToTotalPixels to target around 0.5–1.0 megapixels on mid-range GPUs (e.g., ~720p equivalent). Higher pixel counts improve detail but increase VRAM and render time. The node preserves aspect ratio, so you can scale without distortion.'
    },
    {
      question: 'Does the output include audio, and can I disable it?',
      answer:
        'MiniMaxH3ImageToVideo can produce a native audio track alongside the video. SaveVideo writes it into the MP4 if present. If you prefer a silent clip, generate as usual and then mute or replace the audio in a video editor. This avoids extra inference.'
    },
    {
      question: 'How fast is the 8-step model compared to the base?',
      answer:
        'The FastH3 8-Step V2 checkpoint is a DMD2-distilled variant that renders in just 8 sampling steps, significantly reducing inference time versus the base H3 model. Actual speed depends on your GPU, resolution, and clip length.'
    },
    {
      question: 'How do I get consistent results between runs?',
      answer:
        'Set a fixed seed in the MiniMaxH3ImageToVideo node and keep the same input image, total pixel setting, and clip parameters (duration and fps). This makes the output reproducible across runs.'
    }
  ]
}

export type SampleKey = 'turnaround' | 'fasth3'

/** The design preview's sample workflows, by the switcher's value. */
export const nodeGraphSamples: Readonly<Record<SampleKey, NodeGraphWorkflow>> =
  {
    turnaround: nodeGraphWorkflowSample,
    fasth3: nodeGraphFastH3Sample
  }
