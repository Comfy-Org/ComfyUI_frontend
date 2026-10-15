import type { AstroIntegration } from 'astro'
import { join } from 'node:path'

import { websiteRoot } from '@website/paths'

const nodeGraphWorkflow = join(
  websiteRoot,
  'src/routes/design-previews/node-graph-workflow.astro'
)

/** Mock pages a designer shares from a pull request preview. */
export const DESIGN_PREVIEW_ROUTES = [
  '/hub-preview/node-graph-workflow',
  '/zh-CN/hub-preview/node-graph-workflow',
  '/hub-preview/node-graph-workflow-api',
  '/zh-CN/hub-preview/node-graph-workflow-api'
].map((pattern) => ({ pattern, entrypoint: nodeGraphWorkflow }))

export function isDesignPreviewBuild(
  vercelEnv: string | undefined = process.env.VERCEL_ENV
): boolean {
  return vercelEnv !== 'production'
}

/** Injects the design preview routes in every build except production. */
export function designPreviews(): AstroIntegration {
  return {
    name: 'design-previews',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        if (!isDesignPreviewBuild()) return
        for (const route of DESIGN_PREVIEW_ROUTES) injectRoute(route)
      }
    }
  }
}
