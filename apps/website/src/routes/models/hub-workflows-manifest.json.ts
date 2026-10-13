import { hubWorkflowName } from '@/config/hub-models'
import hubWorkflowNames from '@/config/hub-workflow-names.json' with { type: 'json' }
import { buildHubWorkflowsManifest } from '@/config/hub-workflows-manifest'
import { hubWorkflowsRouting } from '@/config/hub-workflows-routing'
import { workflowModels } from '@/config/workshop-workflow-content'
import {
  catalogUnavailable,
  cmsEnabled,
  loadSiteCatalog
} from '@/lib/cms/catalog'

/**
 * comfy-router#46 fetches this from the website origin directly, not through
 * comfy.org, and passes the public /hub/workflows/manifest.json through here.
 */
export async function GET() {
  const catalog = cmsEnabled() ? await loadSiteCatalog() : undefined
  const failure = catalog && !catalog.ok ? catalogUnavailable() : undefined
  if (failure) return failure
  if (catalog?.ok) {
    const pages = catalog.projection.items
      .filter((item) => item.kind === 'WORKFLOW')
      .map((item) => item.slug.split('/').at(-1))
      .filter((name): name is string => Boolean(name))
    const destinations = new Set(
      catalog.projection.items
        .filter((item) => item.kind === 'WORKFLOW')
        .map((item) => `${item.slug}/`)
    )
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
  const built = workflowModels.map(({ slug }) => hubWorkflowName(slug)).sort()
  if (built.join('\n') !== [...hubWorkflowNames].sort().join('\n'))
    throw new Error(
      'hub-workflow-names.json does not match the built workflow pages; run vitest -u on hub-workflow-names.test.ts.'
    )
  return Response.json(
    buildHubWorkflowsManifest(hubWorkflowNames, hubWorkflowsRouting)
  )
}
