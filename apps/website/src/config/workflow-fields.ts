/**
 * What each launch workflow asks its reader for, and where that answer goes in
 * the graph: the node, the input on it, and the words the reader sees instead
 * of the node's own name.
 *
 * These bindings come from the Comfy API work on the workflow prototype, where
 * every one of them was exercised against the SDK. They are not derived from
 * the registry, which declares the loaders a graph has but not which of them a
 * person is meant to fill in, nor what to call them.
 */
export interface WorkflowField {
  readonly node: string
  readonly input: string
  readonly label: string
  readonly kind: 'image' | 'video' | 'audio' | 'text' | 'number'
  readonly help?: string
  readonly min?: number
  readonly max?: number
  readonly step?: number
  /**
   * Which reading of a camera pose this number is. A workflow that asks for
   * all three is asking where the camera stands, which is one question with
   * one control rather than three boxes of degrees.
   */
  readonly pose?: 'azimuth' | 'elevation' | 'zoom'
}

/** The templates revision the example inputs below are served from. */
const TEMPLATE_REVISION = '90c71fb78b3726392d010ff62a8e79e92d7296ad'

export const templateAsset = (folder: string, file: string) =>
  `https://raw.githubusercontent.com/Comfy-Org/workflow_templates/${TEMPLATE_REVISION}/${folder}/${file}`

/** What Cloud takes in one request, which is more than a model call takes. */
export const WORKFLOW_MAX_UPLOAD_BYTES = 100 * 1024 * 1024

const FIELDS: Record<string, readonly WorkflowField[]> = {
  video_ltx2_3_i2v: [
    { node: '269', input: 'image', label: 'Starting image', kind: 'image' },
    {
      node: '320:319',
      input: 'value',
      label: 'Describe the motion',
      kind: 'text'
    }
  ],
  video_minimax_h3_r2v: [
    { node: '137', input: 'image', label: 'First reference', kind: 'image' },
    { node: '139', input: 'image', label: 'Second reference', kind: 'image' },
    {
      node: '138',
      input: 'value',
      label: 'Describe your scene',
      kind: 'text'
    }
  ],
  video_ltx2_3_flf2v: [
    { node: '31', input: 'image', label: 'Start frame', kind: 'image' },
    { node: '39', input: 'image', label: 'End frame', kind: 'image' },
    {
      node: '129:128',
      input: 'text',
      label: 'Describe the transition',
      kind: 'text'
    }
  ],
  api_seedance2_5_video_editing: [
    { node: '35', input: 'file', label: 'Your video', kind: 'video' },
    {
      node: '39',
      input: 'model.prompt',
      label: 'Describe the new background',
      kind: 'text'
    }
  ],
  template_ltx2_3_obscura_remova_lora_remove_object_from_video: [
    { node: '39', input: 'file', label: 'Your footage', kind: 'video' },
    {
      node: '54:9',
      input: 'text',
      label: 'What should be removed?',
      kind: 'text'
    }
  ],
  template_ltx2_3_lora_video_outpainting: [
    { node: '5060', input: 'video', label: 'Your video', kind: 'video' },
    {
      node: '5151:5145',
      input: 'image',
      label: 'Reference frame',
      kind: 'image',
      help: 'Upload a frame from your video for this template’s image input.'
    },
    {
      node: '5151:5097',
      input: 'value',
      label: 'Aspect ratio width',
      kind: 'number',
      min: 1,
      max: 32,
      step: 1
    },
    {
      node: '5151:5098',
      input: 'value',
      label: 'Aspect ratio height',
      kind: 'number',
      min: 1,
      max: 32,
      step: 1
    },
    {
      node: '5151:5138',
      input: 'text',
      label: 'Describe the expanded scene',
      kind: 'text'
    }
  ],
  video_wan_animate2: [
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
  ],
  video_ltx2_3_ia2v: [
    { node: '269', input: 'image', label: 'Your character', kind: 'image' },
    { node: '276', input: 'audio', label: 'Voice recording', kind: 'audio' },
    {
      node: '340:319',
      input: 'value',
      label: 'Describe the scene and performance',
      kind: 'text'
    }
  ],
  video_wan21_scail2_character_replacement: [
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
  ],
  'templates-wan2_1_infinitetalk_music': [
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
  ],
  template_ltx2_3_ic_lora_ingredients: [
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
  ],
  'templates-character_sheet': [
    {
      node: '1',
      input: 'image',
      label: 'Your character',
      kind: 'image'
    }
  ],
  image_qwen_image_edit_2511: [
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
  ],
  'templates-qwen_multiangle.app': [
    { node: '1', input: 'image', label: 'Your subject', kind: 'image' },
    {
      node: '3',
      input: 'horizontal_angle',
      label: 'Horizontal angle',
      kind: 'number',
      min: 0,
      max: 360,
      step: 1,
      pose: 'azimuth'
    },
    {
      node: '3',
      input: 'vertical_angle',
      label: 'Vertical angle',
      kind: 'number',
      min: -30,
      max: 60,
      step: 1,
      pose: 'elevation'
    },
    {
      node: '3',
      input: 'zoom',
      label: 'Camera distance',
      kind: 'number',
      min: 0,
      max: 10,
      step: 0.1,
      pose: 'zoom'
    }
  ],
  image_flux2_fp8: [
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
  ],
  'templates-fashion_shoot_vton': [
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
  ],
  'templates-product_scene_relight': [
    { node: '1', input: 'image', label: 'Your product', kind: 'image' },
    { node: '2', input: 'image', label: 'New background', kind: 'image' },
    {
      node: '14',
      input: 'value',
      label: 'Describe your product and its materials',
      kind: 'text'
    }
  ],
  'templates-photo_to_product_vid': [
    {
      node: '1',
      input: 'image',
      label: 'Your product',
      kind: 'image'
    }
  ],
  utility_seedvr2_image_upscale: [
    { node: '24', input: 'image', label: 'Your image', kind: 'image' }
  ],
  utility_seedvr2_3b_int8_upscale_video: [
    {
      node: '73',
      input: 'file',
      label: 'Your video',
      kind: 'video'
    }
  ],
  utility_nanobanana_pro_product_upscale: [
    {
      node: '2',
      input: 'image',
      label: 'Your product',
      kind: 'image'
    }
  ],
  utility_topaz_illustration_upscale: [
    {
      node: '5',
      input: 'image',
      label: 'Your illustration',
      kind: 'image'
    }
  ],
  utility_hitpaw_general_image_enhance: [
    {
      node: '2',
      input: 'image',
      label: 'Your portrait',
      kind: 'image'
    }
  ],
  template_ltx2_3_lora_restore_archival_footage: [
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
  ],
  flux_fill_inpaint_example: [
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
  ],
  flux_fill_outpaint_example: [
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
  ],
  image_qwen_image_layered: [
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
  ],
  utility_birefnet_remove_background: [
    {
      node: '17',
      input: 'image',
      label: 'Your image',
      kind: 'image'
    }
  ],
  'templates_rob_portrait_light_migration.app': [
    { node: '7', input: 'image', label: 'Your portrait', kind: 'image' },
    { node: '6', input: 'image', label: 'Lighting reference', kind: 'image' }
  ],
  api_bria_eraser: [
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
}

/** The form a workflow opens onto, or nothing when nobody has mapped it. */
export function workflowFields(
  templateName: string
): readonly WorkflowField[] | undefined {
  return FIELDS[templateName]
}
