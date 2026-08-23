import type { Model } from '../../../config/models'

export interface ModelExploreCatalogSummary {
  catalogCount: number
  localComponentCount: number
  partnerIntegrationCount: number
}

export function summarizeModelExploreCatalog(
  catalog: readonly Pick<Model, 'directory'>[]
): ModelExploreCatalogSummary {
  const partnerIntegrationCount = catalog.filter(
    ({ directory }) => directory === 'partner_nodes'
  ).length

  return {
    catalogCount: catalog.length,
    localComponentCount: catalog.length - partnerIntegrationCount,
    partnerIntegrationCount
  }
}
