import type { WorkshopModel } from '../../config/models-catalogue'
import type { BrowseEntry } from './browse-entry'
import { cardViewFor } from './catalogue-card'
import type { CatalogueEntry } from './catalogue-entries'
import {
  buildCatalogue,
  cheapestOperation,
  entryUseCases
} from './catalogue-entries'
import type { FacetedTemplate } from './facet-fields'

function modelEntry(
  entry: Extract<CatalogueEntry, { kind: 'model' }>,
  models: readonly WorkshopModel[]
): BrowseEntry {
  const { model } = entry
  return {
    key: entry.key,
    kind: 'model',
    title: model.name,
    useCases: entryUseCases(entry, models),
    outputs: entry.operations.flatMap(
      (operation): readonly string[] =>
        operation.modalities ?? (operation.modality ? [operation.modality] : [])
    ),
    provider: model.provider,
    runsHere: true,
    needsCustomNodes: false,
    models: [],
    tags: model.capabilities,
    standing: model.recommendedRank ?? Number.POSITIVE_INFINITY,
    date: undefined,
    credits: cheapestOperation(entry).creditsPerRun,
    card: cardViewFor(entry, new Set())
  }
}

function workflowEntry(
  entry: Extract<CatalogueEntry, { kind: 'workflow' | 'app' }>,
  models: readonly WorkshopModel[],
  needsCustomNodes: ReadonlySet<string>
): BrowseEntry {
  const { template } = entry
  return {
    key: entry.key,
    kind: entry.kind,
    title: template.title,
    useCases: entryUseCases(entry, models),
    outputs: [template.mediaType],
    provider: template.partner,
    runsHere: entry.runsOn !== undefined,
    needsCustomNodes: needsCustomNodes.has(template.name),
    models: template.models,
    tags: template.tags,
    standing: template.usage,
    date: template.date,
    credits: undefined,
    card: cardViewFor(entry, needsCustomNodes)
  }
}

export function browseEntries(
  templates: readonly FacetedTemplate[],
  models: readonly WorkshopModel[],
  needsCustomNodes: ReadonlySet<string>
): BrowseEntry[] {
  return buildCatalogue(templates, models).map((entry) =>
    entry.kind === 'model'
      ? modelEntry(entry, models)
      : workflowEntry(entry, models, needsCustomNodes)
  )
}
