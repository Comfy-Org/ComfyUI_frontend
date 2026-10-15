import type { PlaygroundExample } from '@/config/workshop-playground'

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
  readonly inputs: readonly string[]
  readonly models: readonly string[]
  readonly customNodes: readonly string[]
  readonly author?: string
  readonly examples: readonly PlaygroundExample[]
  /** The request that runs this workflow through the API, when it has one. */
  readonly api?: { readonly snippet: string }
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
  inputs: ['Character image', 'Seed'],
  models: ['Nano Banana Pro'],
  customNodes: ['ComfyUI-KJNodes', 'ComfyUI-Impact-Pack'],
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
  ]
}

/** The same sample, for a workflow that also runs through the API. */
export const nodeGraphWorkflowWithApiSample: NodeGraphWorkflow = {
  ...nodeGraphWorkflowSample,
  slug: 'node-graph-preview-api',
  api: {
    snippet: [
      'curl -X POST https://cloud.comfy.org/api/prompt \\',
      '  -H "X-API-Key: $COMFY_API_KEY" \\',
      '  -H "Content-Type: application/json" \\',
      '  -d @character-turnaround.api.json'
    ].join('\n')
  }
}
