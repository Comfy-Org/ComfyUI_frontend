import type { FaqItem } from '@/components/common/FAQSection.vue'
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
  inputs: ['Character image', 'Seed'],
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
