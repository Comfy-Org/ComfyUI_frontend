import type { RunOutput } from '../../config/workshop-run'
import type { TranslationKey } from '../../i18n/translations'

const KIND_KEYS: Record<RunOutput['kind'], TranslationKey> = {
  image: 'workshop.output.kindImage',
  video: 'workshop.output.kindVideo',
  audio: 'workshop.output.kindAudio',
  '3d': 'workshop.output.kindModel',
  text: 'workshop.output.kindText',
  other: 'workshop.output.kindFile'
}

export interface OutputLabel {
  readonly key: TranslationKey
  readonly ordinal?: number
}

/**
 * Names each file of a finished run by what it is. The first is the result the
 * model was asked for; the text that follows it is the Router's own answer,
 * which no visitor asked for by name.
 */
export function outputLabels(
  outputs: readonly Pick<RunOutput, 'kind'>[]
): readonly OutputLabel[] {
  const keys = outputs.map((output, index) =>
    index > 0 && output.kind === 'text'
      ? 'workshop.output.kindResponse'
      : KIND_KEYS[output.kind]
  )
  const totals = keys.reduce(
    (counted, key) => counted.set(key, (counted.get(key) ?? 0) + 1),
    new Map<TranslationKey, number>()
  )
  const seen = new Map<TranslationKey, number>()
  return keys.map((key) => {
    const ordinal = (seen.get(key) ?? 0) + 1
    seen.set(key, ordinal)
    return totals.get(key) === 1 ? { key } : { key, ordinal }
  })
}
