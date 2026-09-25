import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import { workshopPageSchema } from '../../../config/workshop-page-state'
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

/** Describes authored controls, not a promise that every combination is valid. */
export function modelCapabilities(
  model: WorkshopModelDetail | undefined,
  studio?: CinematicModel
): readonly ModelCapability[] {
  if (!model?.execution || model.incompleteReason) return []
  const schema = workshopPageSchema(model)
  const rows = new Map<CapabilityKind, readonly string[]>()
  const inputs = new Set<string>()
  for (const field of schema) {
    const name = field.name.replace(/^(param_|setting_|config_)/, '')
    if (['prompt', 'text', 'text_prompt', 'prompt_text'].includes(name))
      inputs.add('text')
    const media = field.kind === 'file' ? field : urlUploadField(field)
    if (media) {
      for (const kind of ['image', 'video', 'audio']) {
        if (media.accept.some((accept) => accept.startsWith(`${kind}/`)))
          inputs.add(kind)
      }
    }
    let kind: CapabilityKind | undefined = [
      'duration',
      'duration_seconds',
      'durationSeconds'
    ].includes(name)
      ? 'duration'
      : ['resolution', 'size', 'imageSize'].includes(name)
        ? 'resolution'
        : ['aspect_ratio', 'aspectRatio', 'ratio'].includes(name)
          ? 'aspect'
          : name === 'quality' ||
              (name === 'mode' &&
                field.kind === 'select' &&
                field.options.every(
                  (option) => option === 'std' || option === 'pro'
                ))
            ? 'quality'
            : ['generate_audio', 'generateAudio', 'sound'].includes(name)
              ? 'audio'
              : ['fps', 'frame_rate'].includes(name)
                ? 'fps'
                : undefined
    if (!kind) continue
    if (
      name === 'size' &&
      field.kind === 'select' &&
      field.options.every((option) => /^\d+:\d+$/.test(String(option)))
    )
      kind = 'aspect'
    if (field.kind === 'select') rows.set(kind, field.options.map(String))
    else if (
      field.kind === 'number' &&
      field.min !== undefined &&
      field.max !== undefined
    ) {
      rows.set(kind, [`${field.min}–${field.max}`])
    } else if (field.kind === 'toggle') rows.set(kind, ['on', 'off'])
  }
  if (inputs.size) rows.set('inputs', [...inputs])
  if (studio?.video) {
    rows.set('firstFrame', [studio.video.firstFrame])
    rows.set('lastFrame', [
      studio.video.lastFrame ? 'supported' : 'unsupported'
    ])
    rows.set('duration', studio.video.durations.map(String))
    rows.set(
      studio.video.resolutionField === 'mode' ? 'quality' : 'resolution',
      studio.video.resolutions
    )
    if (studio.video.aspects.length) rows.set('aspect', studio.video.aspects)
    if (studio.video.generateAudio) rows.set('audio', ['on', 'off'])
  }
  if (studio?.imageAspects?.length) rows.set('aspect', studio.imageAspects)
  if (studio?.referenceMax)
    rows.set('references', [String(studio.referenceMax)])
  return [...rows].map(([kind, values]) => ({ kind, values }))
}
