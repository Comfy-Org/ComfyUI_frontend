/**
 * Sorts Comfy-Org/workflow_templates `templates/index.json` into the
 * designer's modality › task tree and collections for the Hub preview mock.
 * Usage: pnpm generate:workflow-catalogue-mock /path/to/templates/index.json
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'

import { websiteRoot } from '@website/paths'
import type {
  MockModality,
  MockTask,
  WorkflowCatalogueMockEntry,
  WorkflowCollection
} from '@/lib/workshop/workflow-catalogue-mock-data'
import {
  MOCK_TASKS,
  WORKFLOW_CATALOGUE_MOCK_PATH,
  WORKFLOW_COLLECTIONS
} from '@/lib/workshop/workflow-catalogue-mock-data'
import { isDirectExecution } from './script-entry-point'

const OUTPUT = join(websiteRoot, 'public', WORKFLOW_CATALOGUE_MOCK_PATH)
const THUMBNAIL_BASE =
  'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates'

const templateSchema = z.object({
  name: z.string(),
  title: z.string(),
  mediaSubtype: z.string().optional(),
  tags: z.array(z.string()).default([]),
  models: z.array(z.string()).default([]),
  io: z
    .object({
      outputs: z
        .array(z.object({ mediaType: z.string().optional() }))
        .default([])
    })
    .optional()
})
type Template = z.infer<typeof templateSchema>

const indexSchema = z.array(
  z.object({
    title: z.string(),
    type: z.string(),
    templates: z.array(templateSchema)
  })
)

interface Rule<K extends string> {
  readonly key: K
  readonly tags?: readonly string[]
  readonly words?: RegExp
}

const VIDEO_TAGS = [
  'Video',
  'Image to Video',
  'Text to Video',
  'Reference to Video',
  'Audio to Video',
  'FLF2V',
  'Lip Sync',
  'Video Edit',
  'Video to Video',
  'Video Extend',
  'Video Upscale',
  'Motion Control'
]

const TASK_RULES: Record<MockModality, readonly Rule<MockTask>[]> = {
  image: [
    {
      key: 'upscale',
      tags: ['Image Upscale'],
      words: /\b(upscal\w*|enhanc\w*|restor\w*)\b/
    },
    {
      key: 'edit',
      words:
        /\b(edit\w*|inpaint\w*|outpaint\w*|remov\w*|relight\w*|style transfer|swap|eraser?|try on|restyle)\b/
    },
    {
      key: 'control',
      tags: [
        'ControlNet',
        'Pose Map',
        'Depth',
        'Depth Estimation',
        'Normal Estimation',
        'Albedo Estimation'
      ],
      words: /\b(controlnet|canny|depth|pose|normal|albedo)\b/
    },
    { key: 'generate', tags: ['Text to Image'] },
    {
      key: 'edit',
      tags: [
        'Image Edit',
        'Inpainting',
        'Outpainting',
        'Relight',
        'Remove Background',
        'Style Transfer',
        'Virtual Try-On',
        'Element Segmentation',
        'Layer Decompose'
      ]
    }
  ],
  video: [
    {
      key: 'upscale',
      tags: ['Video Upscale', 'Frame Interpolation'],
      words: /\b(upscal\w*|enhanc\w*)\b/
    },
    {
      key: 'motion-transfer',
      tags: ['Motion Control', 'Character Replacement'],
      words:
        /\b(motion|dance|trajectory|character animation|replacement|effect|vfx|squish|inflation|googly|illusion)\b/
    },
    {
      key: 'lip-sync',
      tags: ['Lip Sync', 'Audio to Video'],
      words: /\b(talking|avatar|lip ?sync|dubbing|audio driven)\b/
    },
    {
      key: 'control',
      tags: ['ControlNet', 'Pose Map', 'Depth'],
      words: /\b(control\w*|canny|depth|pose|camera|lineart|normal map)\b/
    },
    {
      key: 'edit',
      tags: [
        'Video Edit',
        'Video to Video',
        'Inpainting',
        'Outpainting',
        'Remove Background',
        'Video Extend',
        'Element Segmentation',
        'Style Transfer'
      ],
      words:
        /\b(edit\w*|restyle\w*|remov\w*|extend\w*|inpaint\w*|outpaint\w*|replace|swap|restore)\b/
    },
    { key: 'generate', words: /\btext to video\b/ },
    {
      key: 'image-to-video',
      tags: [
        'Image to Video',
        'FLF2V',
        'Reference to Video',
        'Character Reference'
      ],
      words:
        /\b(image to video|i2v|reference to video|flf2v|first last|start end)\b/
    }
  ],
  audio: [
    {
      key: 'speech',
      tags: ['Text to Speech', 'TTS', 'Voice Cloning', 'Speech to Text'],
      words: /\b(speech|voice|dialogue|tts)\b/
    }
  ],
  '3d': [{ key: 'from-text', tags: ['Text to 3D'], words: /\btext to\b/ }]
}

const FALLBACK_TASK: Record<MockModality, MockTask> = {
  image: 'generate',
  video: 'generate',
  audio: 'music',
  '3d': 'from-image'
}

const COLLECTION_RULES: readonly Rule<WorkflowCollection>[] = [
  {
    key: 'characters',
    tags: ['Character Replacement', 'Character Reference'],
    words: /\b(character\w*|face ?swap|swap faces?|avatar\w*|talking photo)\b/
  },
  {
    key: 'game-assets',
    tags: ['Game'],
    words: /\b(sprite\w*|game\w*|skybox|turnaround|character sheet)\b/
  },
  {
    key: 'product',
    tags: ['Virtual Try-On', 'Brand Design'],
    words:
      /\b(product\w*|fashion|try on|ugc|e commerce|ecommerce|logo\w*|mockups?|billboard|packaging|ads?|poster|outfit|ootd)\b/
  },
  {
    key: 'architecture',
    words:
      /\b(architect\w*|interiors?|real estate|rooms?|buildings?|house|floor plan)\b/
  },
  {
    key: 'storyboards',
    words:
      /\b(storyboards?|multishot|multi shot|contact sheet|consistent shots|storytelling|script)\b/
  },
  {
    key: 'anime',
    tags: ['Anime'],
    words: /\b(anime|pixel art|comics?|manga|cartoon|illustration|line art)\b/
  }
]

const COLLECTION_CATEGORIES: Readonly<Record<string, WorkflowCollection>> = {
  'Product & Ads': 'product'
}

function text(template: Template): string {
  return `${template.title} ${template.name}`
    .toLowerCase()
    .replace(/[_\-:.()[\]]+/g, ' ')
}

function matches<K extends string>(rule: Rule<K>, template: Template) {
  return (
    !!rule.tags?.some((tag) => template.tags.includes(tag)) ||
    !!rule.words?.test(text(template))
  )
}

function modalityOf(
  template: Template,
  categoryType: string
): MockModality | undefined {
  if (categoryType === 'video' || categoryType === 'audio') return categoryType
  if (categoryType === '3d') return '3d'
  if (categoryType !== 'image') return undefined
  const outputs = template.io?.outputs.map((output) => output.mediaType) ?? []
  if (
    outputs.includes('video') ||
    template.tags.some((tag) => VIDEO_TAGS.includes(tag))
  )
    return 'video'
  if (
    template.tags.some((tag) => tag === 'Image to 3D' || tag === 'Text to 3D')
  )
    return '3d'
  return 'image'
}

/** Where a template sits in the designer's tree, or nothing for a text-only one. */
export function classifyTemplate(
  template: Template,
  category: { readonly title: string; readonly type: string }
):
  | Pick<WorkflowCatalogueMockEntry, 'modality' | 'task' | 'collections'>
  | undefined {
  const modality = modalityOf(template, category.type)
  if (!modality) return undefined
  const task =
    TASK_RULES[modality].find((rule) => matches(rule, template))?.key ??
    FALLBACK_TASK[modality]
  const fromCategory = COLLECTION_CATEGORIES[category.title]
  const collections = WORKFLOW_COLLECTIONS.filter(
    (key) =>
      key === fromCategory ||
      COLLECTION_RULES.some(
        (rule) => rule.key === key && matches(rule, template)
      )
  )
  return { modality, task, collections }
}

/** Every classified template as a mock entry, plus the names left out. */
export function buildWorkflowCatalogueMock(rawIndex: unknown): {
  entries: WorkflowCatalogueMockEntry[]
  skipped: string[]
} {
  const entries: WorkflowCatalogueMockEntry[] = []
  const skipped: string[] = []
  for (const category of indexSchema.parse(rawIndex))
    for (const template of category.templates) {
      const placed = classifyTemplate(template, category)
      if (!placed) {
        skipped.push(template.name)
        continue
      }
      entries.push({
        name: template.name,
        title: template.title,
        ...((template.mediaSubtype ?? 'webp') === 'webp' && {
          thumbnail: `${THUMBNAIL_BASE}/${template.name}-1.webp`
        }),
        ...placed,
        models: template.models,
        href: '#'
      })
    }
  return { entries, skipped }
}

function tally(keys: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const key of keys) counts[key] = (counts[key] ?? 0) + 1
  return counts
}

function main() {
  const source = process.argv[2]
  if (!source) throw new Error('Pass the path to templates/index.json')
  const { entries, skipped } = buildWorkflowCatalogueMock(
    JSON.parse(readFileSync(source, 'utf8'))
  )
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(
    OUTPUT,
    `[\n${entries.map((entry) => JSON.stringify(entry)).join(',\n')}\n]\n`
  )
  const tasks = tally(
    entries.map((entry) => `${entry.modality} › ${entry.task}`)
  )
  const ordered = Object.entries(MOCK_TASKS).flatMap(([modality, list]) =>
    list.map((task) => `${modality} › ${task}`)
  )
  process.stdout.write(
    [
      `Wrote ${entries.length} workflows; left out ${skipped.length} text-only: ${skipped.join(', ')}`,
      ...ordered.map((key) => `  ${key}: ${tasks[key] ?? 0}`),
      ...Object.entries(tally(entries.flatMap((entry) => entry.collections)))
        .sort(
          ([a], [b]) =>
            WORKFLOW_COLLECTIONS.findIndex((key) => key === a) -
            WORKFLOW_COLLECTIONS.findIndex((key) => key === b)
        )
        .map(([key, count]) => `  collection ${key}: ${count}`),
      `  no collection: ${entries.filter((entry) => !entry.collections.length).length}`
    ].join('\n') + '\n'
  )
}

if (isDirectExecution(process.argv[1], import.meta.filename)) main()
