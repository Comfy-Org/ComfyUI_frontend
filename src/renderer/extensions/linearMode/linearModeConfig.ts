import type { LinearModeTemplate, PromotedWidget } from './linearModeTypes'

const defaultLinearPromotedWidgets: PromotedWidget[] = [
  {
    nodeId: 6,
    widgetName: 'text',
    displayName: 'Prompt',
    type: 'text',
    config: {
      multiline: true,
      placeholder: 'Describe the image you want to generate...',
      maxLength: 5000
    },
    tooltip: 'Describe what you want to see in the image',
    group: 'content'
  },
  {
    nodeId: 7,
    widgetName: 'text',
    displayName: 'Negative Prompt',
    type: 'text',
    config: {
      multiline: true,
      placeholder: 'What to avoid in the image...'
    },
    tooltip: 'Describe what you want to avoid',
    group: 'content'
  },
  {
    nodeId: 3,
    widgetName: 'seed',
    displayName: 'Seed',
    type: 'number',
    config: {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      randomizable: true
    },
    tooltip:
      'Random seed for generation. Use same seed for reproducible results.',
    group: 'generation'
  },
  {
    nodeId: 3,
    widgetName: 'steps',
    displayName: 'Steps',
    type: 'slider',
    config: {
      min: 1,
      max: 150,
      step: 1,
      default: 20
    },
    tooltip: 'Number of denoising steps. Higher = better quality but slower.',
    group: 'generation'
  },
  {
    nodeId: 3,
    widgetName: 'cfg',
    displayName: 'CFG Scale',
    type: 'slider',
    config: {
      min: 0,
      max: 20,
      step: 0.5,
      default: 7.0
    },
    tooltip: 'How closely to follow the prompt. Higher = more literal.',
    group: 'generation'
  },
  {
    nodeId: 3,
    widgetName: 'sampler_name',
    displayName: 'Sampler',
    type: 'combo',
    config: {
      options: ['euler', 'euler_a', 'dpmpp_2m', 'dpmpp_sde', 'ddim']
    },
    tooltip: 'Sampling algorithm to use',
    group: 'advanced'
  },
  {
    nodeId: 3,
    widgetName: 'scheduler',
    displayName: 'Scheduler',
    type: 'combo',
    config: {
      options: ['normal', 'karras', 'exponential', 'sgm_uniform']
    },
    group: 'advanced'
  },
  {
    nodeId: 5,
    widgetName: 'width',
    displayName: 'Width',
    type: 'combo',
    config: {
      options: [512, 768, 1024, 1280, 1536, 2048]
    },
    tooltip: 'Output image width',
    group: 'dimensions'
  },
  {
    nodeId: 5,
    widgetName: 'height',
    displayName: 'Height',
    type: 'combo',
    config: {
      options: [512, 768, 1024, 1280, 1536, 2048]
    },
    tooltip: 'Output image height',
    group: 'dimensions'
  },
  {
    nodeId: 5,
    widgetName: 'batch_size',
    displayName: 'Batch Size',
    type: 'slider',
    config: {
      min: 1,
      max: 8,
      step: 1,
      default: 1
    },
    tooltip: 'Number of images to generate at once',
    group: 'advanced'
  }
]

// @knipIgnore - Will be used by Linear Mode UI components
export const LINEAR_MODE_TEMPLATES: Record<string, LinearModeTemplate> = {
  'template-default-linear': {
    id: 'template-default-linear',
    name: 'Linear Mode Template',
    templatePath: '/templates/template-default-linear.json',
    promotedWidgets: defaultLinearPromotedWidgets,
    description: 'Default Linear Mode template for simplified image generation',
    tags: ['text-to-image', 'default', 'recommended']
  }
}

// @knipIgnore - Will be used by Linear Mode UI components
export const WIDGET_GROUPS = {
  content: { label: 'Content', order: 1 },
  dimensions: { label: 'Image Size', order: 2 },
  generation: { label: 'Generation Settings', order: 3 },
  advanced: { label: 'Advanced', order: 4, collapsible: true }
} as const

export function getTemplateConfig(
  templateId: string
): LinearModeTemplate | null {
  return LINEAR_MODE_TEMPLATES[templateId] ?? null
}
