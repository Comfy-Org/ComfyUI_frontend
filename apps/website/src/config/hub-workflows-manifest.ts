import { z } from 'zod'

import { hubWorkflowHref } from './hub-models'

const HUB_WORKFLOW_OWNERS = ['workflows-site', 'website'] as const
const LEGACY_WORKFLOW_PATH = /^\/workflows\/[A-Za-z0-9][A-Za-z0-9_-]*\/$/

export interface HubWorkflowsRouting {
  readonly defaultOwner: (typeof HUB_WORKFLOW_OWNERS)[number]
  readonly legacyRedirects: Readonly<Record<string, string>>
}

export const hubWorkflowsManifestSchema = z
  .object({
    version: z.literal(1),
    defaultOwner: z.enum(HUB_WORKFLOW_OWNERS),
    pages: z.array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)),
    legacyRedirects: z.record(z.string(), z.string())
  })
  .strict()
  .superRefine(({ pages, legacyRedirects }, ctx) => {
    if (pages.some((name, index) => index > 0 && pages[index - 1] >= name))
      ctx.addIssue({
        code: 'custom',
        message: 'pages must be sorted and unique'
      })
    const pageHrefs = new Set(pages.map(hubWorkflowHref))
    for (const [source, destination] of Object.entries(legacyRedirects)) {
      if (!LEGACY_WORKFLOW_PATH.test(source))
        ctx.addIssue({
          code: 'custom',
          message: `${source} is not an exact /workflows/<slug>/ path`
        })
      if (!pageHrefs.has(destination))
        ctx.addIssue({
          code: 'custom',
          message: `${source} points at ${destination}, which is not a /hub/workflows page this site builds`
        })
    }
  })

export type HubWorkflowsManifest = z.output<typeof hubWorkflowsManifestSchema>

/** The file comfy-router reads to route `/hub/workflows/*` and old `/workflows/*` URLs. */
export function buildHubWorkflowsManifest(
  pages: readonly string[],
  routing: HubWorkflowsRouting
): HubWorkflowsManifest {
  return hubWorkflowsManifestSchema.parse({
    version: 1,
    defaultOwner: routing.defaultOwner,
    pages: [...pages].sort(),
    legacyRedirects: routing.legacyRedirects
  })
}
