import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import { workshopPageSchema } from '../../../config/workshop-page-state'
import type { FieldSchema } from '../../../config/workshop-playground'
import { urlUploadField } from '../../../config/workshop-playground'
import type { CinematicModel } from './models'
import type { Locale } from '../../../i18n/translations'
import { modelGuidanceCopy } from './model-guidance-copy'

export function videoModelSummary(
  model: CinematicModel,
  locale: Locale = 'en'
) {
  if (!model.video) return undefined
  const guidance = videoDurationGuidance(
    [{ kind: 'duration', values: model.video.durations.map(String) }],
    locale
  )
  const durations = [...new Set(model.video.durations)].sort((a, b) => a - b)
  const contiguous =
    durations.length > 4 &&
    durations.every(
      (value, index) =>
        Number.isInteger(value) &&
        (index === 0 || value === durations[index - 1] + 1)
    )
  const supported = contiguous
    ? `${durations[0]}–${durations.at(-1)}${modelGuidanceCopy(locale).secondsUnit}`
    : guidance.supported
  return [supported, guidance.suggestion].filter(Boolean).join(' · ')
}

export function videoDurationGuidance(
  capabilities: readonly ModelCapability[],
  locale: Locale = 'en'
): { supported: string; suggestedSeconds?: number; suggestion?: string } {
  const values = capabilities.find((row) => row.kind === 'duration')?.values
  const copy = modelGuidanceCopy(locale)
  if (!values?.length) return { supported: copy.unknownDuration }
  const supported = values
    .map((value) =>
      value === '-1'
        ? copy.autoDuration
        : /^\d+(?:\.\d+)?(?:[–-]\d+(?:\.\d+)?)?$/.test(value)
          ? `${value}${copy.secondsUnit}`
          : value
    )
    .join(' / ')
  const durations = values.map(Number)
  if (durations.some((value) => !Number.isFinite(value) || value <= 0))
    return { supported }
  const suggestedSeconds = [...durations].sort(
    (a, b) => Math.abs(a - 5) - Math.abs(b - 5) || a - b
  )[0]
  return {
    supported,
    suggestedSeconds,
    suggestion: `${copy.startingPoint}: ${suggestedSeconds}${copy.secondsUnit}`
  }
}

type CapabilityKind =
  | 'duration'
  | 'resolution'
  | 'aspect'
  | 'quality'
  | 'audio'
  | 'fps'
  | 'inputs'
  | 'references'
  | 'firstFrame'
  | 'lastFrame'
export interface ModelCapability {
  readonly kind: CapabilityKind
  readonly values: readonly string[]
}

const capabilityNames: Readonly<Record<string, CapabilityKind>> = {
  duration: 'duration',
  duration_seconds: 'duration',
  durationSeconds: 'duration',
  resolution: 'resolution',
  size: 'resolution',
  imageSize: 'resolution',
  aspect_ratio: 'aspect',
  aspectRatio: 'aspect',
  ratio: 'aspect',
  quality: 'quality',
  generate_audio: 'audio',
  generateAudio: 'audio',
  sound: 'audio',
  fps: 'fps',
  frame_rate: 'fps'
}

function fieldCapability(
  field: FieldSchema,
  name: string
): CapabilityKind | undefined {
  if (field.kind === 'select') {
    if (
      name === 'size' &&
      field.options.every((option) => /^\d+:\d+$/.test(String(option)))
    )
      return 'aspect'
    if (
      name === 'mode' &&
      field.options.every((option) => option === 'std' || option === 'pro')
    )
      return 'quality'
  }
  return Object.hasOwn(capabilityNames, name)
    ? capabilityNames[name]
    : undefined
}

function fieldValues(field: FieldSchema): readonly string[] | undefined {
  if (field.kind === 'select') return field.options.map(String)
  if (
    field.kind === 'number' &&
    field.min !== undefined &&
    field.max !== undefined
  )
    return [`${field.min}–${field.max}`]
  if (field.kind === 'toggle') return ['on', 'off']
  return undefined
}

function collectInputs(field: FieldSchema, name: string, inputs: Set<string>) {
  if (['prompt', 'text', 'text_prompt', 'prompt_text'].includes(name))
    inputs.add('text')
  const media = field.kind === 'file' ? field : urlUploadField(field)
  if (!media) return
  for (const kind of ['image', 'video', 'audio']) {
    if (media.accept.some((accept) => accept.startsWith(`${kind}/`)))
      inputs.add(kind)
  }
}

function applyVideoCapabilities(
  rows: Map<CapabilityKind, readonly string[]>,
  video: NonNullable<CinematicModel['video']>
) {
  rows.set('firstFrame', [video.firstFrame])
  rows.set('lastFrame', [video.lastFrame ? 'supported' : 'unsupported'])
  rows.set('duration', video.durations.map(String))
  rows.set(
    video.resolutionField === 'mode' ? 'quality' : 'resolution',
    video.resolutions
  )
  if (video.aspects.length) rows.set('aspect', video.aspects)
  if (video.generateAudio) rows.set('audio', ['on', 'off'])
}

function applyStudioCapabilities(
  rows: Map<CapabilityKind, readonly string[]>,
  studio?: CinematicModel
) {
  if (studio?.video) applyVideoCapabilities(rows, studio.video)
  if (studio?.imageAspects?.length) rows.set('aspect', studio.imageAspects)
  if (studio?.referenceMax)
    rows.set('references', [String(studio.referenceMax)])
}

export function modelCapabilities(
  model: WorkshopModelDetail | undefined,
  studio?: CinematicModel
): readonly ModelCapability[] {
  if (!model?.execution || model.incompleteReason) return []
  const rows = new Map<CapabilityKind, readonly string[]>()
  const inputs = new Set<string>()
  for (const field of workshopPageSchema(model)) {
    const name = field.name.replace(/^(param_|setting_|config_)/, '')
    collectInputs(field, name, inputs)
    const kind = fieldCapability(field, name)
    const values = fieldValues(field)
    if (kind && values) rows.set(kind, values)
  }
  if (inputs.size) rows.set('inputs', [...inputs])
  applyStudioCapabilities(rows, studio)
  return [...rows].map(([kind, values]) => ({ kind, values }))
}
