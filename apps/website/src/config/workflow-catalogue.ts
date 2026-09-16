import templates from '../data/workflow-metadata.json'

export const TEMPLATE_REVISION = '90c71fb78b3726392d010ff62a8e79e92d7296ad'
export const templateAsset = (folder: string, file: string) =>
  `https://raw.githubusercontent.com/Comfy-Org/workflow_templates/${TEMPLATE_REVISION}/${folder}/${file}`

interface WorkflowField {
  node: string
  input: string
  label: string
  kind: 'image' | 'video' | 'audio' | 'text' | 'number'
  min?: number
  max?: number
  step?: number
}

export interface CuratedWorkflow {
  slug: string
  template: string
  title: string
  description: string
  category: string
  fields: WorkflowField[]
}

export const workflowCategories = [
  'Product photography',
  'Animate your character',
  'Edit & enhance'
] as const

export const workflows: CuratedWorkflow[] = [
  {
    slug: 'replace-product-background',
    template: 'templates-product_scene_relight',
    title: 'Put your product in a new scene',
    category: 'Product photography',
    description:
      'Combine a product photo and a background. Match the lighting while preserving the product’s materials.',
    fields: [
      { node: '1', input: 'image', label: 'Your product', kind: 'image' },
      { node: '2', input: 'image', label: 'New background', kind: 'image' },
      {
        node: '14',
        input: 'value',
        label: 'Describe your product and its materials',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'change-material',
    template: 'image_qwen_image_edit_2511',
    title: 'Change a material',
    category: 'Product photography',
    description:
      'Try a new fabric, texture, or finish on an object using a material reference.',
    fields: [
      {
        node: '41',
        input: 'image',
        label: 'Your original image',
        kind: 'image'
      },
      {
        node: '83',
        input: 'image',
        label: 'Material reference',
        kind: 'image'
      },
      {
        node: '170:151',
        input: 'prompt',
        label: 'What should change?',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'change-camera-angle',
    template: 'templates-qwen_multiangle.app',
    title: 'See your subject from a new angle',
    category: 'Product photography',
    description:
      'Explore another viewpoint from a single reference image. Adjust the camera angle and distance.',
    fields: [
      { node: '1', input: 'image', label: 'Your subject', kind: 'image' },
      {
        node: '3',
        input: 'horizontal_angle',
        label: 'Horizontal angle',
        kind: 'number',
        min: 0,
        max: 360,
        step: 1
      },
      {
        node: '3',
        input: 'vertical_angle',
        label: 'Vertical angle',
        kind: 'number',
        min: -30,
        max: 60,
        step: 1
      },
      {
        node: '3',
        input: 'zoom',
        label: 'Camera distance',
        kind: 'number',
        min: 0,
        max: 10,
        step: 0.1
      }
    ]
  },
  {
    slug: 'copy-movement',
    template: 'video_wan_animate2',
    title: 'Copy movement from a video',
    category: 'Animate your character',
    description:
      'Give your character the gestures, dance, or movement from a reference video.',
    fields: [
      { node: '189', input: 'image', label: 'Your character', kind: 'image' },
      {
        node: '240',
        input: 'file',
        label: 'Movement reference',
        kind: 'video'
      },
      {
        node: '261:3',
        input: 'text',
        label: 'Describe the character and scene',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'make-character-talk',
    template: 'video_ltx2_3_ia2v',
    title: 'Make your character talk',
    category: 'Animate your character',
    description:
      'Turn a portrait and voice recording into a talking character with matching expressions.',
    fields: [
      { node: '269', input: 'image', label: 'Your character', kind: 'image' },
      { node: '276', input: 'audio', label: 'Voice recording', kind: 'audio' },
      {
        node: '340:319',
        input: 'value',
        label: 'Describe the scene and performance',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'match-portrait-lighting',
    template: 'templates_rob_portrait_light_migration.app',
    title: 'Match lighting from a reference',
    category: 'Edit & enhance',
    description:
      'Give a portrait the mood, light direction, and color of another image.',
    fields: [
      { node: '7', input: 'image', label: 'Your portrait', kind: 'image' },
      { node: '6', input: 'image', label: 'Lighting reference', kind: 'image' }
    ]
  },
  {
    slug: 'extend-image',
    template: 'flux_fill_outpaint_example',
    title: 'Extend an image’s borders',
    category: 'Edit & enhance',
    description:
      'Make room for a wider crop or a different layout by filling beyond the original frame.',
    fields: [
      { node: '17', input: 'image', label: 'Your image', kind: 'image' },
      {
        node: '23',
        input: 'text',
        label: 'Describe the surrounding scene',
        kind: 'text'
      },
      ...(['left', 'right', 'top', 'bottom'] as const).map((input) => ({
        node: '44',
        input,
        label: `Extend ${input} (px)`,
        kind: 'number' as const,
        min: 0,
        max: 1024,
        step: 8
      }))
    ]
  },
  {
    slug: 'upscale-image',
    template: 'utility_seedvr2_image_upscale',
    title: 'Upscale and restore detail',
    category: 'Edit & enhance',
    description: 'Give a small or soft image a sharper finish with SeedVR2.',
    fields: [{ node: '24', input: 'image', label: 'Your image', kind: 'image' }]
  }
]

export function workflowMetadata(workflow: CuratedWorkflow) {
  const template = templates.find((item) => item.name === workflow.template)
  if (!template) throw new Error(`Missing template: ${workflow.template}`)
  return {
    models: template.models,
    author: template.author,
    thumbnail: templateAsset('templates', `${workflow.template}-1.webp`),
    examples: template.examples
  }
}

export const workflowPath = (slug: string) => `/models/workflows/${slug}/`
