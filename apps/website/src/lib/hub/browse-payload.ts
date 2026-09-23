import type { WorkshopModel } from '../../config/models-catalogue'
import type { BrowseEntry } from './browse-entry'
import { cardViewFor } from './catalogue-card'
import type { CatalogueEntry } from './catalogue-entries'
import { buildCatalogue, entryUseCases } from './catalogue-entries'
import { launchCategoryOf } from '../../config/workshop-launch'
import type { FacetedTemplate } from './facet-fields'
import { workflowDisplayTitle } from './workflow-title'

function modelEntry(
  entry: Extract<CatalogueEntry, { kind: 'model' }>,
  models: readonly WorkshopModel[]
): BrowseEntry {
  const { model } = entry
  return {
    key: entry.key,
    kind: 'model',
    title: entry.name,
    shelves: entryUseCases(entry, models),
    models: [],
    tags: model.capabilities,
    standing: model.recommendedRank ?? Number.POSITIVE_INFINITY,
    date: undefined,
    card: cardViewFor(entry, new Set(), models)
  }
}

function workflowEntry(
  entry: Extract<CatalogueEntry, { kind: 'workflow' }>,
  models: readonly WorkshopModel[],
  needsCustomNodes: ReadonlySet<string>
): BrowseEntry {
  const { template } = entry
  return {
    key: entry.key,
    kind: entry.kind,
    title: workflowDisplayTitle(template),
    // The workflows half is shelved by the launch spec's categories, not by
    // the use cases the models half is read through.
    shelves: [launchCategoryOf(template.name)].filter(
      (key) => key !== undefined
    ),
    models: template.models,
    tags: template.tags,
    standing: template.usage,
    date: template.date,
    card: cardViewFor(entry, needsCustomNodes, models)
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
