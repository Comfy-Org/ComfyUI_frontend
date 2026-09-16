import type { WorkshopModel } from '../../config/models-catalogue'
import type { BrowseEntry } from './browse-entry'
import { cardViewFor } from './catalogue-card'
import type { CatalogueEntry } from './catalogue-entries'
import { buildCatalogue, entryUseCases } from './catalogue-entries'
import type { FacetedTemplate } from './facet-fields'

function outputsOf(entry: CatalogueEntry): readonly string[] {
  if (entry.kind !== 'model') return [entry.template.mediaType]
  return entry.operations.flatMap(
    (model): readonly string[] =>
      model.modalities ?? (model.modality ? [model.modality] : [])
  )
}

export function browseEntries(
  templates: readonly FacetedTemplate[],
  models: readonly WorkshopModel[],
  needsCustomNodes: ReadonlySet<string>,
  prices: ReadonlyMap<string, string>
): BrowseEntry[] {
  return buildCatalogue(templates, models).map((entry) => ({
    key: entry.key,
    kind: entry.kind,
    title: entry.kind === 'model' ? entry.model.name : entry.template.title,
    useCases: entryUseCases(entry, models),
    outputs: outputsOf(entry),
    provider:
      entry.kind === 'model' ? entry.model.provider : entry.template.partner,
    runsHere: entry.kind === 'model' || entry.runsOn !== undefined,
    needsCustomNodes:
      entry.kind !== 'model' && needsCustomNodes.has(entry.template.name),
    models: entry.kind === 'model' ? [] : entry.template.models,
    standing:
      entry.kind === 'model'
        ? (entry.model.recommendedRank ?? Number.POSITIVE_INFINITY)
        : entry.template.usage,
    date: entry.kind === 'model' ? undefined : entry.template.date,
    credits: entry.kind === 'model' ? entry.model.creditsPerRun : undefined,
    card: cardViewFor(entry, needsCustomNodes, prices)
  }))
}
