import { z } from 'zod'

/** Where the preview fetches the full template catalogue, sorted into the designer's tasks. */
export const WORKFLOW_CATALOGUE_MOCK_PATH =
  '/hub-mock/workflow-catalogue-mock.json'

const MOCK_MODALITIES = ['image', 'video', 'audio', '3d'] as const
export type MockModality = (typeof MOCK_MODALITIES)[number]

const MOCK_TASK_NAMES = [
  'generate',
  'edit',
  'upscale',
  'control',
  'image-to-video',
  'motion-transfer',
  'lip-sync',
  'speech',
  'music',
  'from-image',
  'from-text'
] as const
export type MockTask = (typeof MOCK_TASK_NAMES)[number]

/** The designer's tasks under each output type, in sidebar order. */
export const MOCK_TASKS = {
  image: ['generate', 'edit', 'upscale', 'control'],
  video: [
    'generate',
    'image-to-video',
    'edit',
    'motion-transfer',
    'lip-sync',
    'upscale',
    'control'
  ],
  audio: ['speech', 'music'],
  '3d': ['from-image', 'from-text']
} as const satisfies Record<MockModality, readonly MockTask[]>

/** Every collection a workflow can be listed in, in chip order. */
export const WORKFLOW_COLLECTIONS = [
  'characters',
  'game-assets',
  'product',
  'architecture',
  'storyboards',
  'anime'
] as const
export type WorkflowCollection = (typeof WORKFLOW_COLLECTIONS)[number]

/** The designer's long names behind each short task label, so a search for one finds the task. */
export const MOCK_TASK_KEYWORDS: Partial<
  Record<`${MockModality}:${MockTask}`, readonly string[]>
> = {
  'image:edit': [
    'inpaint',
    'remove',
    'relight',
    'style transfer',
    'edit & clean up photos'
  ],
  'image:upscale': ['upscale & restore'],
  'image:control': ['ControlNet', 'depth', 'pose', 'tools'],
  'video:edit': ['edit video', 'create & edit videos'],
  'video:motion-transfer': ['VFX', 'motion transfer'],
  'video:lip-sync': ['lip sync', 'avatars', 'talking heads'],
  'video:upscale': ['upscale & restore'],
  'video:control': ['ControlNet', 'depth', 'pose', 'tools'],
  'audio:speech': ['voice', 'speech'],
  'audio:music': ['music', 'sound'],
  '3d:from-image': ['3D models', 'textures'],
  '3d:from-text': ['3D models', 'textures']
}

/** The designer's long names behind each collection chip. */
export const COLLECTION_KEYWORDS: Record<
  WorkflowCollection,
  readonly string[]
> = {
  characters: ['animate characters', 'swap faces', 'swap characters'],
  'game-assets': ['character sheet', 'sprite sheet', 'game assets'],
  product: [
    'create product photos & ads',
    'fashion',
    'ads',
    'try-on',
    'UGC',
    'e-commerce',
    'logos'
  ],
  architecture: ['architecture', 'interiors', 'real estate'],
  storyboards: ['storyboards'],
  anime: ['anime', 'pixel art', 'comics']
}

export const workflowCatalogueMockEntrySchema = z
  .object({
    name: z.string().min(1),
    title: z.string().min(1),
    thumbnail: z.url().optional(),
    modality: z.enum(MOCK_MODALITIES),
    task: z.enum(MOCK_TASK_NAMES),
    collections: z.array(z.enum(WORKFLOW_COLLECTIONS)),
    models: z.array(z.string()),
    href: z.string()
  })
  .refine((entry) =>
    MOCK_TASKS[entry.modality].some((task) => task === entry.task)
  )

export type WorkflowCatalogueMockEntry = z.infer<
  typeof workflowCatalogueMockEntrySchema
>
