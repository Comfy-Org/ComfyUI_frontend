import { hubWorkflowName } from '@/config/hub-models'
import hubWorkflowNames from '@/config/hub-workflow-names.json' with { type: 'json' }
import { buildHubWorkflowsManifest } from '@/config/hub-workflows-manifest'
import { hubWorkflowsRouting } from '@/config/hub-workflows-routing'
import { workflowModels } from '@/config/workshop-workflow-content'
import { catalogUnavailable, cmsEnabled } from '@/lib/cms/catalog'
import { loadEverySiteCatalogCard } from '@/lib/cms/catalog-list-all'

/**
 * comfy-router#46 fetches this from the website origin directly, not through
 * comfy.org, and passes the public /hub/workflows/manifest.json through here.
 */
export async function GET() {
  return cmsEnabled() ? catalogManifest() : staticManifest()
}
function addDestinations(
  destinations: Set<string>,
  models: { href?: string }[]
) {
  for (const model of models)
    if (model.href) destinations.add(`${model.href.replace(/\/$/, '')}/`)
}
async function catalogDestinations() {
  const catalog = await loadEverySiteCatalogCard(undefined, 'en', 'workflows')
  if (!catalog.ok) return catalogUnavailable()
  const destinations = new Set<string>()
  addDestinations(destinations, catalog.models)
  return destinations
}
async function catalogManifest() {
  const destinations = await catalogDestinations()
  if (destinations instanceof Response) return destinations
  const pages = [...destinations]
    .map((path) => path.split('/').filter(Boolean).at(-1))
    .filter((name): name is string => Boolean(name))
  return Response.json(
    buildHubWorkflowsManifest(pages, {
      ...hubWorkflowsRouting,
      legacyRedirects: Object.fromEntries(
        Object.entries(hubWorkflowsRouting.legacyRedirects).filter(
          ([, destination]) => destinations.has(destination)
        )
      )
    })
  )
}
function staticManifest() {
  const built = workflowModels.map(({ slug }) => hubWorkflowName(slug)).sort()
  if (built.join('\n') !== [...hubWorkflowNames].sort().join('\n'))
    throw new Error(
      'hub-workflow-names.json does not match the built workflow pages; run vitest -u on hub-workflow-names.test.ts.'
    )
  return Response.json(
    buildHubWorkflowsManifest(hubWorkflowNames, hubWorkflowsRouting)
  )
}
