import snapshot from '../../data/cloud-nodes.snapshot.json'
import details from '../../data/hubTemplateDetails.json'
import { needsOwnEndpoint } from '../../config/workshop-launch'

/** How far a workflow can be taken without the reader building anything. */
export type WorkflowReach =
  /** The page runs it, as a form and a Run button. */
  | 'here'
  /** The shared Cloud endpoint runs it: the request carries the graph. */
  | 'cloud'
  /** Nothing shared can run it. A developer deploys it before calling it. */
  | 'endpoint'

const loose = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

// A pack is named three ways between the registry and Cloud's own listing, and
// none of them is canonical, so a match is a match on any of them.
const CARRIED = new Set(
  snapshot.packs.flatMap((pack) =>
    [pack.id, pack.displayName].filter(Boolean).map((name) => loose(name))
  )
)

const carried = (pack: string) => {
  const name = loose(pack)
  return [...CARRIED].some(
    (known) => known === name || known.includes(name) || name.includes(known)
  )
}

/**
 * The packs a workflow needs that Cloud does not carry. They are what decides
 * whether a developer can call the shared endpoint or has to stand up their
 * own, which is the one difference between the two that changes their work.
 */
export function packsCloudLacks(packs: readonly string[]): readonly string[] {
  return packs.filter((pack) => !carried(pack))
}

const packsOf = (templateName: string): readonly string[] => {
  const detail: unknown = (details as Record<string, unknown>)[templateName]
  const packs =
    detail && typeof detail === 'object' && 'requiresCustomNodes' in detail
      ? detail.requiresCustomNodes
      : undefined
  return Array.isArray(packs) ? packs.filter((p) => typeof p === 'string') : []
}

/** The packs this one needs that Cloud does not carry. */
export function missingFromCloud(templateName: string): readonly string[] {
  return packsCloudLacks(packsOf(templateName))
}

export function workflowReach(
  templateName: string,
  runsInline: boolean
): WorkflowReach {
  if (needsOwnEndpoint(templateName) || missingFromCloud(templateName).length)
    return 'endpoint'
  return runsInline ? 'here' : 'cloud'
}
