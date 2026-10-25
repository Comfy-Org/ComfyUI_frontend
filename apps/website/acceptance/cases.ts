export const modelCases = [
  {
    slug: 'bfl--flux-2-max--generate-images',
    routerId: 'bfl/flux-2-max',
    kind: 'image',
    promptField: 'prompt',
    prompt: 'A red ceramic cup on a blue table, studio photograph.',
    advancedField: 'seed',
    advancedValue: '314159',
    files: [],
    smoke: true
  },
  {
    slug: 'byteplus--seedream-4-5--edit-images',
    routerId: 'byteplus/seedream-4-5-251128',
    kind: 'image',
    promptField: 'prompt',
    prompt: 'Keep the shapes in this image and change the background to blue.',
    advancedField: 'seed',
    advancedValue: '314159',
    files: [{ field: 'images', fixture: 'reference.png' }],
    smoke: true
  },
  {
    slug: 'byteplus--seedance-2-5-text-to-video--generate-videos',
    routerId: 'byteplus/dreamina-seedance-2-5-260628',
    kind: 'video',
    promptField: 'prompt',
    prompt: 'A red ceramic cup slowly rotating on a blue table.',
    advancedField: 'seed',
    advancedValue: '314159',
    files: [],
    smoke: false
  },
  {
    slug: 'byteplus--seedance-2-5-first-last-frame--animate-images',
    routerId: 'byteplus/dreamina-seedance-2-5-260628',
    kind: 'video',
    promptField: 'prompt',
    prompt: 'Animate the shapes with a gentle camera pan.',
    advancedField: 'seed',
    advancedValue: '314159',
    files: [
      { field: 'first_frame_url', fixture: 'reference.png' },
      { field: 'last_frame_url', fixture: 'last-frame.png' }
    ],
    smoke: false
  },
  {
    slug: 'byteplus--seedance-2-5-edit-video--edit-videos',
    routerId: 'byteplus/dreamina-seedance-2-5-260628',
    kind: 'video',
    promptField: 'prompt',
    prompt: 'Change the background to blue while preserving the moving shapes.',
    advancedField: 'seed',
    advancedValue: '314159',
    files: [{ field: 'video_url', fixture: 'reference.mp4' }],
    smoke: false
  },
  {
    slug: 'heygen--starfish-tts--audio',
    routerId: 'heygen/starfish',
    kind: 'audio',
    promptField: 'text',
    prompt: 'Welcome to the workshop. Today we are testing a new recording.',
    advancedField: 'speed',
    advancedValue: '1.1',
    files: [],
    smoke: false
  }
] as const

export type ModelCase = (typeof modelCases)[number]
