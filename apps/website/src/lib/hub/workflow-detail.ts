import type {
  GeneratedExample,
  GeneratedField,
  Modality,
  WorkshopModelDetail
} from '../../config/workshop'
import hubTemplateDetails from '../../data/hubTemplateDetails.json'
import hubTemplates from '../../data/hubTemplates.json'
import { tagDisplayName } from './tag-aliases'
import type { HubTemplate } from './types'

interface HubIoPort {
  readonly nodeType?: string
  readonly mediaType?: string
  readonly file?: string
}

interface HubTemplateDetails {
  readonly description?: string
  readonly tutorialUrl?: string
  readonly requiresCustomNodes?: readonly string[]
  readonly inputs?: readonly HubIoPort[]
  readonly outputs?: readonly HubIoPort[]
}

interface HubWorkflowStats {
  readonly rating: string
  readonly ratings: number
  readonly avgSeconds: number
  readonly creditsPerRun: number
  readonly cloneCredits: number
}

interface HubIoRow {
  readonly name: string
  readonly type: string
}

export interface HubWorkflowPage {
  readonly template: HubTemplate
  readonly mediaType: string
  readonly details: HubTemplateDetails
  readonly model: WorkshopModelDetail
  readonly stats: HubWorkflowStats
  readonly inputs: readonly HubIoRow[]
  readonly outputs: readonly HubIoRow[]
  readonly related: readonly HubTemplate[]
}

export const hubWorkflowPath = (name: string) => `/workshop/workflows/${name}/`

const templates = hubTemplates as HubTemplate[]
const details = hubTemplateDetails as Record<string, HubTemplateDetails>

export function listHubWorkflows(): readonly HubTemplate[] {
  return templates
}

const FILE_INPUTS: Record<
  string,
  { accept: 'image' | 'video' | 'audio'; label: string }
> = {
  LoadImage: { accept: 'image', label: 'Image' },
  LoadVideo: { accept: 'video', label: 'Video' },
  VHS_LoadVideo: { accept: 'video', label: 'Video' },
  LoadAudio: { accept: 'audio', label: 'Audio' }
}

const MEDIA_TO_MODALITY: Record<string, Modality> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  '3d': '3d'
}

const BASE_CREDITS: Record<string, number> = {
  image: 6,
  video: 40,
  audio: 8,
  '3d': 20
}
const BASE_SECONDS: Record<string, number> = {
  image: 4,
  video: 38,
  audio: 9,
  '3d': 22
}

function seedFor(name: string): number {
  let seed = 0
  for (const char of name) seed = (seed * 31 + char.charCodeAt(0)) % 1_000_003
  return seed
}

function fileFields(inputs: readonly HubIoPort[]): GeneratedField[] {
  const counts = new Map<string, number>()
  return inputs.flatMap((input) => {
    const spec = FILE_INPUTS[input.nodeType ?? '']
    if (!spec) return []
    const index = (counts.get(spec.accept) ?? 0) + 1
    counts.set(spec.accept, index)
    const suffix = index > 1 ? ` ${index}` : ''
    return [
      {
        kind: 'file' as const,
        name: `${spec.accept}${index > 1 ? `_${index}` : ''}`,
        label: `${spec.label}${suffix}`,
        hint: `${spec.label} loaded by the workflow's ${input.nodeType} node.`,
        accept: spec.accept,
        required: true
      }
    ]
  })
}

function optionFields(mediaType: string): GeneratedField[] {
  const shared: GeneratedField[] = [
    {
      kind: 'select',
      name: 'aspect_ratio',
      label: 'Aspect ratio',
      options: ['auto', '1:1', '16:9', '9:16', '4:3'],
      default: 'auto'
    }
  ]
  if (mediaType === 'video') {
    return [
      ...shared,
      {
        kind: 'select',
        name: 'resolution',
        label: 'Resolution',
        options: ['480p', '720p', '1080p'],
        default: '720p'
      },
      {
        kind: 'number',
        name: 'duration',
        label: 'Duration',
        hint: 'Seconds of video to generate.',
        min: 2,
        max: 10,
        step: 1,
        default: 5
      }
    ]
  }
  if (mediaType === 'image') {
    return [
      ...shared,
      {
        kind: 'select',
        name: 'resolution',
        label: 'Resolution',
        options: ['1K', '2K'],
        default: '1K'
      },
      {
        kind: 'select',
        name: 'output_format',
        label: 'Output format',
        options: ['PNG', 'JPEG', 'WEBP'],
        default: 'PNG'
      },
      {
        kind: 'number',
        name: 'n',
        label: 'Number of images',
        hint: '1-4 per run',
        min: 1,
        max: 4,
        step: 1,
        default: 1
      }
    ]
  }
  return []
}

// The index's mediaType describes the thumbnail; what the workflow produces
// is its first output.
function outputMediaType(
  template: HubTemplate,
  detail: HubTemplateDetails
): string {
  return detail.outputs?.[0]?.mediaType ?? template.mediaType
}

function fieldsFor(
  template: HubTemplate,
  detail: HubTemplateDetails
): GeneratedField[] {
  return [
    {
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      hint: 'Type # to reference inputs.',
      multiline: true,
      required: true
    },
    ...fileFields(detail.inputs ?? []),
    ...optionFields(outputMediaType(template, detail)),
    {
      kind: 'number',
      name: 'seed',
      label: 'Seed',
      hint: 'Seed to use for generation.',
      min: 0,
      max: 999_999,
      step: 1,
      default: 42
    }
  ]
}

const IO_TYPES: Record<GeneratedField['kind'], string> = {
  text: 'string',
  file: 'file',
  select: 'enum',
  number: 'int',
  toggle: 'bool'
}

const OUTPUT_TYPES: Record<string, string> = {
  image: 'png',
  video: 'mp4',
  audio: 'mp3',
  '3d': 'glb'
}

function examplesFor(template: HubTemplate): GeneratedExample[] {
  return template.thumbnails.map((thumbnailUrl, index) => ({
    name: `${template.name}-${index + 1}`,
    title: template.title,
    description: details[template.name]?.description ?? '',
    tags: template.tags.map(tagDisplayName),
    thumbnailUrl,
    values: {}
  }))
}

export function getHubWorkflowPage(name: string): HubWorkflowPage | undefined {
  const template = templates.find((t) => t.name === name)
  if (!template) return undefined
  const detail = details[name] ?? {}
  const seed = seedFor(name)
  const mediaType = outputMediaType(template, detail)
  const creditsPerRun = (BASE_CREDITS[mediaType] ?? 6) + (seed % 4)
  const fields = fieldsFor(template, detail)
  const stats: HubWorkflowStats = {
    rating: (4.5 + (seed % 5) / 10).toFixed(1),
    ratings: Math.max(3, Math.round(template.usage / 200)),
    avgSeconds: (BASE_SECONDS[mediaType] ?? 6) + (seed % 7),
    creditsPerRun,
    cloneCredits: creditsPerRun * 450
  }
  const model: WorkshopModelDetail = {
    slug: template.name,
    name: template.title,
    workflowCount: 1,
    href: hubWorkflowPath(template.name),
    routerId: `hub/${template.name}`,
    provider: template.username || 'ComfyUI',
    modality: MEDIA_TO_MODALITY[mediaType],
    capabilities: template.tags.map(tagDisplayName),
    runs: template.usage,
    creditsPerRun,
    thumbnailUrl: template.thumbnails[0],
    fields,
    defaults: {},
    examples: examplesFor(template)
  }
  const outputs: HubIoRow[] = [
    ...(detail.outputs ?? []).map((port, index) => ({
      name:
        index === 0
          ? (port.mediaType ?? 'output')
          : `${port.mediaType ?? 'output'}_${index + 1}`,
      type: OUTPUT_TYPES[port.mediaType ?? ''] ?? 'file'
    })),
    { name: 'seed', type: 'int' },
    { name: 'latency_ms', type: 'int' }
  ]
  const related = templates
    .filter(
      (t) =>
        t.name !== template.name &&
        t.tags.some((tag) => template.tags.includes(tag))
    )
    .sort((a, b) => b.usage - a.usage)
    .slice(0, 3)
  return {
    template,
    mediaType,
    details: detail,
    model,
    stats,
    inputs: fields.map((field) => ({
      name: field.name,
      type:
        field.kind === 'number' && field.step < 1
          ? 'float'
          : IO_TYPES[field.kind]
    })),
    outputs,
    related
  }
}
