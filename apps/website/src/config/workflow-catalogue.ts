import templates from '../data/workflow-metadata.json'

export const TEMPLATE_REVISION = '90c71fb78b3726392d010ff62a8e79e92d7296ad'
export const templateAsset = (folder: string, file: string) =>
  `https://raw.githubusercontent.com/Comfy-Org/workflow_templates/${TEMPLATE_REVISION}/${folder}/${file}`

interface WorkflowField {
  node: string
  input: string
  label: string
  kind: 'image' | 'video' | 'audio' | 'text' | 'number'
  help?: string
  min?: number
  max?: number
  step?: number
}

export interface CuratedWorkflow {
  slug: string
  template: string
  title: string
  description: string
  category: (typeof workflowCategories)[number]
  fields: WorkflowField[]
}

export const workflowCategories = [
  'Animate characters',
  'Create product photos & ads',
  'Upscale & restore',
  'Edit & clean up photos'
] as const

// Ordered by distinct Cloud template starters, August 17–September 16, 2026.
// See WORKFLOWS_PROTOTYPE.md for filters and shelf deduplication.
export const workflows: CuratedWorkflow[] = [
  {
    slug: 'change-material',
    template: 'image_qwen_image_edit_2511',
    title: 'Change a material',
    category: 'Create product photos & ads',
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
    slug: 'copy-movement',
    template: 'video_wan_animate2',
    title: 'Copy movement from a video',
    category: 'Animate characters',
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
    category: 'Animate characters',
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
    slug: 'replace-video-character',
    template: 'video_wan21_scail2_character_replacement',
    title: 'Replace a character in a video',
    description:
      'Put your character into a reference performance while following the original movement.',
    category: 'Animate characters',
    fields: [
      {
        node: '30',
        input: 'image',
        label: 'Your character',
        kind: 'image'
      },
      {
        node: '155',
        input: 'file',
        label: 'Reference performance',
        kind: 'video'
      }
    ]
  },
  {
    slug: 'upscale-image',
    template: 'utility_seedvr2_image_upscale',
    title: 'Upscale and restore detail',
    category: 'Upscale & restore',
    description: 'Give a small or soft image a sharper finish with SeedVR2.',
    fields: [{ node: '24', input: 'image', label: 'Your image', kind: 'image' }]
  },
  {
    slug: 'upscale-video',
    template: 'utility_seedvr2_3b_int8_upscale_video',
    title: 'Upscale a video',
    description:
      'Enlarge low-resolution footage and recover finer detail with SeedVR2.',
    category: 'Upscale & restore',
    fields: [
      {
        node: '73',
        input: 'file',
        label: 'Your video',
        kind: 'video'
      }
    ]
  },
  {
    slug: 'change-camera-angle',
    template: 'templates-qwen_multiangle.app',
    title: 'See your subject from a new angle',
    category: 'Create product photos & ads',
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
    slug: 'edit-selected-region',
    template: 'flux_fill_inpaint_example',
    title: 'Edit a selected region',
    description:
      'Describe a change and use a mask to choose exactly where it should appear.',
    category: 'Edit & clean up photos',
    fields: [
      {
        node: '17',
        input: 'image',
        label: 'Your image',
        kind: 'image'
      },
      {
        node: 'workshop-mask',
        input: 'image',
        label: 'Edit mask',
        kind: 'image',
        help: 'Upload a black-and-white mask matching your image dimensions. White marks the area to edit; black keeps the rest unchanged.'
      },
      {
        node: '47:23',
        input: 'text',
        label: 'Describe the replacement',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'make-character-sing',
    template: 'templates-wan2_1_infinitetalk_music',
    title: 'Make your character sing',
    description:
      'Bring a character to life with a song or rap recording. Match mouth movements and performance to your audio.',
    category: 'Animate characters',
    fields: [
      { node: '284', input: 'image', label: 'Your character', kind: 'image' },
      {
        node: '125',
        input: 'audio',
        label: 'Song or rap recording',
        kind: 'audio'
      },
      {
        node: '330:332',
        input: 'positive_prompt',
        label: 'Describe the performance',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'animate-reference-sheet',
    template: 'template_ltx2_3_ic_lora_ingredients',
    title: 'Animate a scene from a reference sheet',
    description:
      'Keep characters, props, and settings consistent with a reference sheet while directing the action in a short clip.',
    category: 'Animate characters',
    fields: [
      {
        node: '724',
        input: 'image',
        label: 'Character, props, and setting reference sheet',
        kind: 'image',
        help: 'Upload one composite image showing the characters, props, and setting you want in the scene.'
      },
      {
        node: '129:211',
        input: 'on_false',
        label: 'Describe the reference sheet and action',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'extend-image',
    template: 'flux_fill_outpaint_example',
    title: 'Extend an image’s borders',
    category: 'Edit & clean up photos',
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
    slug: 'separate-image-layers',
    template: 'image_qwen_image_layered',
    title: 'Separate an image into editable layers',
    description:
      'Break a composition into transparent image layers for further editing.',
    category: 'Edit & clean up photos',
    fields: [
      {
        node: '74',
        input: 'image',
        label: 'Your image',
        kind: 'image'
      },
      {
        node: '116',
        input: 'value',
        label: 'Describe the image',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'product-mockup',
    template: 'image_flux2_fp8',
    title: 'Create a product mockup',
    description: 'Apply a design to a product using two reference images.',
    category: 'Create product photos & ads',
    fields: [
      {
        node: '42',
        input: 'image',
        label: 'Reference image 1',
        kind: 'image'
      },
      {
        node: '46',
        input: 'image',
        label: 'Reference image 2',
        kind: 'image'
      },
      {
        node: '62:6',
        input: 'text',
        label: 'Describe how to combine the references',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'remove-background',
    template: 'utility_birefnet_remove_background',
    title: 'Remove an image background',
    description:
      'Isolate your subject on a transparent background for layouts and compositing.',
    category: 'Edit & clean up photos',
    fields: [
      {
        node: '17',
        input: 'image',
        label: 'Your image',
        kind: 'image'
      }
    ]
  },
  {
    slug: 'character-turnaround',
    template: 'templates-character_sheet',
    title: 'Create a character turnaround',
    description:
      'Build a reference sheet with multiple views and close-ups from one character image.',
    category: 'Animate characters',
    fields: [
      {
        node: '1',
        input: 'image',
        label: 'Your character',
        kind: 'image'
      }
    ]
  },
  {
    slug: 'match-portrait-lighting',
    template: 'templates_rob_portrait_light_migration.app',
    title: 'Match lighting from a reference',
    category: 'Edit & clean up photos',
    description:
      'Give a portrait the mood, light direction, and color of another image.',
    fields: [
      { node: '7', input: 'image', label: 'Your portrait', kind: 'image' },
      { node: '6', input: 'image', label: 'Lighting reference', kind: 'image' }
    ]
  },
  {
    slug: 'remove-object',
    template: 'api_bria_eraser',
    title: 'Remove an object',
    description:
      'Remove a masked object and fill the space with the surrounding scene.',
    category: 'Edit & clean up photos',
    fields: [
      {
        node: '2',
        input: 'image',
        label: 'Your image',
        kind: 'image'
      },
      {
        node: 'workshop-mask',
        input: 'image',
        label: 'Edit mask',
        kind: 'image',
        help: 'Upload a black-and-white mask matching your image dimensions. White marks the area to edit; black keeps the rest unchanged.'
      }
    ]
  },
  {
    slug: 'try-on-outfit',
    template: 'templates-fashion_shoot_vton',
    title: 'Try an outfit on a character',
    description:
      'Combine a character and outfit reference to create a fashion shoot with several poses.',
    category: 'Create product photos & ads',
    fields: [
      {
        node: '1',
        input: 'image',
        label: 'Your character',
        kind: 'image'
      },
      {
        node: '35',
        input: 'image',
        label: 'Outfit reference',
        kind: 'image'
      },
      {
        node: '5',
        input: 'value',
        label: 'Describe the fashion shoot',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'sharpen-product-photo',
    template: 'utility_nanobanana_pro_product_upscale',
    title: 'Sharpen a product photo',
    description:
      'Enhance the clarity and detail of a product shot for a larger presentation.',
    category: 'Upscale & restore',
    fields: [
      {
        node: '2',
        input: 'image',
        label: 'Your product',
        kind: 'image'
      }
    ]
  },
  {
    slug: 'upscale-illustration',
    template: 'utility_topaz_illustration_upscale',
    title: 'Upscale an illustration',
    description: 'Enlarge artwork and refine its details with Topaz Reimagine.',
    category: 'Upscale & restore',
    fields: [
      {
        node: '5',
        input: 'image',
        label: 'Your illustration',
        kind: 'image'
      }
    ]
  },
  {
    slug: 'replace-product-background',
    template: 'templates-product_scene_relight',
    title: 'Put your product in a new scene',
    category: 'Create product photos & ads',
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
    slug: 'restore-portrait-detail',
    template: 'utility_hitpaw_general_image_enhance',
    title: 'Restore portrait detail',
    description:
      'Improve a soft portrait with an enhancement model tuned for faces.',
    category: 'Upscale & restore',
    fields: [
      {
        node: '2',
        input: 'image',
        label: 'Your portrait',
        kind: 'image'
      }
    ]
  },
  {
    slug: 'restore-archival-footage',
    template: 'template_ltx2_3_lora_restore_archival_footage',
    title: 'Restore archival footage',
    description:
      'Give older footage a cleaner, more detailed finish with an archival-restoration workflow.',
    category: 'Upscale & restore',
    fields: [
      {
        node: '5188',
        input: 'file',
        label: 'Your footage',
        kind: 'video'
      },
      {
        node: '5189:5091',
        input: 'text',
        label: 'Describe the restored scene',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'product-photo-to-video',
    template: 'templates-photo_to_product_vid',
    title: 'Turn a product photo into a video',
    description: 'Create product showcase clips from a single product photo.',
    category: 'Create product photos & ads',
    fields: [
      {
        node: '1',
        input: 'image',
        label: 'Your product',
        kind: 'image'
      }
    ]
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
