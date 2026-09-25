import type { Locale } from '../../../i18n/translations'

import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'

import { creativePrompt } from '../../../lib/workshop/cinematic-studio/creative'

import {
  cameraGroups,
  gradeGroup,
  lookGroups,
  directionOption
} from '../../../lib/workshop/cinematic-studio/catalog'

import { tc } from '../../../lib/workshop/cinematic-studio/copy'

import {
  comparisonSettings,
  comparisonSource
} from '../../../lib/workshop/cinematic-studio/comparison'

import { tcComparison } from '../../../lib/workshop/cinematic-studio/comparison-copy'

import type { ComparisonCopyKey } from '../../../lib/workshop/cinematic-studio/comparison-copy'

export function comparisonDirectionLabels(item: SavedCreation, locale: Locale) {
  const direction = item.settings?.direction

  if (!direction) return []

  return [...cameraGroups, ...lookGroups, gradeGroup].flatMap((group) => {
    const option = directionOption(group.part, direction)

    return option.id === 'auto' ? [] : [tc(option.label, locale)]
  })
}

export function comparisonValues(item: SavedCreation, locale: Locale) {
  const t = (key: ComparisonCopyKey) => tcComparison(key, locale)

  const settings = comparisonSettings(item)

  return {
    model: item.modelSlug,

    aspect: item.aspect,

    resolution: settings.resolution,

    duration:
      settings.duration === undefined ? undefined : `${settings.duration}s`,

    seed: settings.seed?.toString(),

    audio:
      settings.audio === undefined
        ? undefined
        : t(settings.audio ? 'on' : 'off'),

    operation: settings.operation ? t(settings.operation) : undefined,

    ...comparisonCreativeValues(item, locale),
    prompt: item.prompt
  }
}

function comparisonCreativeValues(item: SavedCreation, locale: Locale) {
  const t = (key: ComparisonCopyKey) => tcComparison(key, locale)

  return {
    direction: item.settings?.direction
      ? comparisonDirectionLabels(item, locale).join(' · ') || t('automatic')
      : undefined,

    creative: item.settings?.creative
      ? creativePrompt(item.settings.creative, item.kind) || t('noCreative')
      : undefined
  }
}

export function comparisonPanel(
  item: SavedCreation,
  index: number,
  items: readonly SavedCreation[],
  models: readonly { slug: string; name: string }[]
) {
  return {
    item,
    index,
    settings: comparisonSettings(item),
    source: comparisonSource(item, items),
    modelName:
      models.find((model) => model.slug === item.modelSlug)?.name ??
      item.modelSlug
  }
}
