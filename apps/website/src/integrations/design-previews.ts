import type { AstroIntegration } from 'astro'
import { join } from 'node:path'

import { websiteRoot } from '@website/paths'

import { isProductionBuild } from '@/config/build-env'

const nodeGraphWorkflow = join(
  websiteRoot,
  'src/routes/design-previews/node-graph-workflow.astro'
)

/** Mock pages a designer shares from a pull request preview. */
export const DESIGN_PREVIEW_ROUTES = [
  '/hub-preview/node-graph-workflow',
  '/zh-CN/hub-preview/node-graph-workflow'
].map((pattern) => ({ pattern, entrypoint: nodeGraphWorkflow }))

type InjectRoute = (route: (typeof DESIGN_PREVIEW_ROUTES)[number]) => void

/** Injects the design preview routes, unless this is the production build. */
export function injectDesignPreviews(injectRoute: InjectRoute): void {
  if (isProductionBuild()) return
  for (const route of DESIGN_PREVIEW_ROUTES) injectRoute(route)
}

/** Astro integration that adds the design previews to non-production builds. */
export function designPreviews(): AstroIntegration {
  return {
    name: 'design-previews',
    hooks: {
      'astro:config:setup': ({ injectRoute }) =>
        injectDesignPreviews(injectRoute)
    }
  }
}
