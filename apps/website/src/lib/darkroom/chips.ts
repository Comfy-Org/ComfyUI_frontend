/**
 * The short labels beside a row or under the viewer: what made the image, in
 * the same plain words the controls use.
 */
import type { DarkroomRequest } from './request'
import {
  creativityKey,
  darkroomModel,
  darkroomModelName,
  DARKROOM_SHAPES,
  planningKey
} from './vocabulary'

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string

export function shapeLabel(t: Translate, shape: string): string {
  if (shape === 'auto') return t('darkroom.shapes.autoName')
  const known = DARKROOM_SHAPES.find((candidate) => candidate.value === shape)
  return known ? `${t(`darkroom.shapes.${known.key}`)} ${shape}` : shape
}

function formatWhen(created: number, locale: string): string {
  return new Date(created).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function settingsChips(
  t: Translate,
  settings: DarkroomRequest,
  extras: {
    readonly seeds: readonly number[]
    readonly seconds?: number
    readonly created: number
    readonly locale: string
    readonly notes?: boolean
  }
): string[] {
  const { seeds } = extras
  const first = seeds[0]
  const last = seeds[seeds.length - 1]
  return [
    darkroomModelName(settings.model),
    settings.moodboard &&
      t('darkroom.chips.moodboard', { name: settings.moodboard.name }),
    shapeLabel(t, settings.aspectRatio),
    !darkroomModel(settings.model)?.noSize && settings.imageSize,
    seeds.length > 1
      ? t('darkroom.chips.seedRange', { first, last })
      : seeds.length === 1 && t('darkroom.chips.seed', { seed: first }),
    settings.temperature !== 1 &&
      t('darkroom.chips.creativity', {
        word: t(
          `darkroom.creativity.${creativityKey(settings.temperature)}`
        ).toLowerCase(),
        value: settings.temperature
      }),
    settings.thinkingLevel &&
      t('darkroom.chips.planning', {
        level: t(`darkroom.planning.${planningKey(settings.thinkingLevel)}`)
      }),
    settings.mimeType.includes('jpeg') && 'JPEG',
    extras.notes && settings.system && t('darkroom.chips.notes'),
    extras.seconds !== undefined &&
      t('darkroom.chips.seconds', { seconds: extras.seconds }),
    formatWhen(extras.created, extras.locale)
  ].filter((chip): chip is string => typeof chip === 'string' && chip !== '')
}
