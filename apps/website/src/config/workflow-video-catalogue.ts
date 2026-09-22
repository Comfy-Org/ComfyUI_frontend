import type { CuratedWorkflow } from './workflow-catalogue'

export const videoWorkflows: CuratedWorkflow[] = [
  {
    slug: 'image-to-video',
    template: 'video_ltx2_3_i2v',
    title: 'Turn an image into a video',
    description:
      'Bring a still image to life. Describe the movement, camera, and atmosphere for your shot.',
    category: 'Create & edit videos',
    heroPosition: '50% 42%',
    alternatives: [{ name: 'MiniMax H3', template: 'video_minimax_h3_i2v' }],
    fields: [
      { node: '269', input: 'image', label: 'Starting image', kind: 'image' },
      {
        node: '320:319',
        input: 'value',
        label: 'Describe the motion',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'video-from-references',
    template: 'video_minimax_h3_r2v',
    title: 'Create a video from references',
    description:
      'Combine two reference images into a new scene. Describe how your subjects and setting come together.',
    category: 'Create & edit videos',
    fields: [
      { node: '137', input: 'image', label: 'First reference', kind: 'image' },
      { node: '139', input: 'image', label: 'Second reference', kind: 'image' },
      {
        node: '138',
        input: 'value',
        label: 'Describe your scene',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'connect-two-images',
    template: 'video_ltx2_3_flf2v',
    title: 'Connect two images with motion',
    description:
      'Choose the first and last frames, then guide the camera and movement between them.',
    category: 'Create & edit videos',
    fields: [
      { node: '31', input: 'image', label: 'Start frame', kind: 'image' },
      { node: '39', input: 'image', label: 'End frame', kind: 'image' },
      {
        node: '129:128',
        input: 'text',
        label: 'Describe the transition',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'change-video-background',
    template: 'api_seedance2_5_video_editing',
    title: 'Change a video’s background',
    description:
      'Place your footage in a new setting while keeping the subject, action, and timing.',
    category: 'Create & edit videos',
    fields: [
      { node: '35', input: 'file', label: 'Your video', kind: 'video' },
      {
        node: '39',
        input: 'model.prompt',
        label: 'Describe the new background',
        kind: 'text'
      }
    ]
  },
  {
    slug: 'expand-video-frame',
    template: 'template_ltx2_3_lora_video_outpainting',
    title: 'Expand a video’s frame',
    description:
      'Make room around your footage for a wider or taller composition, filling in the scene beyond its edges.',
    category: 'Create & edit videos',
    fields: [
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
    ]
  }
]
