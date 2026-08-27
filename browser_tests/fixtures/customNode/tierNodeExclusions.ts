import { groupBy } from 'es-toolkit'

export type CustomNodeNodeExclusionTier =
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S4'
  | 'S5'
  | 'S6'
  | 'S7'
  | 'S8'

export interface TierNodeExclusionTarget {
  identity: string
  pack: string
}

export interface TierNodeExclusion {
  identity: string
  nodeType: string
  pack: string
  reason: string
  restore: string
  ticket: string
  tiers: readonly CustomNodeNodeExclusionTier[]
}

export const CUSTOM_NODE_TIER_NODE_EXCLUSIONS: readonly TierNodeExclusion[] = [
  {
    identity: 'comfyui-itools@0.6.8',
    nodeType: 'iToolsCropImage',
    pack: 'comfyui-itools',
    reason:
      "the banned 0.6.8 artifact's crop hook captures its preview widget once, then waits without re-reading it; identical runs terminate at either five widgets plus an error or six widgets without one",
    restore:
      'publish and pin a non-banned iTools version whose crop hook waits on the live preview widget, then remove this entry',
    ticket:
      'https://linear.app/comfyorg/issue/FE-1675/e2e-nodes-tests-fix-itools-crop-lifecycle-race-and-restore-s1-s8',
    tiers: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']
  }
]

function exclusionsForPack(
  target: TierNodeExclusionTarget,
  exclusions: readonly TierNodeExclusion[]
): readonly TierNodeExclusion[] {
  const folded = target.pack.toLowerCase()
  return exclusions.filter(
    (exclusion) =>
      exclusion.pack.toLowerCase() === folded &&
      exclusion.identity === target.identity
  )
}

export function eligibleNodeTypesForTier(
  target: TierNodeExclusionTarget,
  tier: CustomNodeNodeExclusionTier,
  nodeTypes: readonly string[],
  exclusions: readonly TierNodeExclusion[] = CUSTOM_NODE_TIER_NODE_EXCLUSIONS
): string[] {
  const packExclusions = exclusionsForPack(target, exclusions)
  for (const exclusion of packExclusions) {
    if (!nodeTypes.includes(exclusion.nodeType))
      throw new Error(
        `${target.pack}/${exclusion.nodeType} ${exclusion.tiers.join('/')} exclusion names a node that no longer registers; remove the stale exclusion`
      )
  }

  const excluded = new Set(
    packExclusions
      .filter((exclusion) => exclusion.tiers.includes(tier))
      .map((exclusion) => exclusion.nodeType)
  )
  return nodeTypes.filter((nodeType) => !excluded.has(nodeType))
}

export function tierNodeExclusionProblems(
  targets: readonly TierNodeExclusionTarget[],
  exclusions: readonly TierNodeExclusion[] = CUSTOM_NODE_TIER_NODE_EXCLUSIONS
): string[] {
  const targetsByPack = groupBy(targets, (target) => target.pack.toLowerCase())
  const seen = new Set<string>()
  const problems: string[] = []

  for (const exclusion of exclusions) {
    const packTargets = targetsByPack[exclusion.pack.toLowerCase()]
    if (!packTargets) {
      problems.push(
        `${exclusion.pack}/${exclusion.nodeType} is not in the manifest`
      )
      continue
    }
    if (!packTargets.some(({ identity }) => identity === exclusion.identity))
      problems.push(
        `${exclusion.pack}/${exclusion.nodeType} is pinned to ${exclusion.identity}, but the manifest uses ${packTargets.map(({ identity }) => identity).join(', ')}`
      )
    for (const tier of exclusion.tiers) {
      const key = `${exclusion.pack.toLowerCase()}/${exclusion.identity}/${exclusion.nodeType}/${tier}`
      if (seen.has(key)) problems.push(`${key} is duplicated`)
      seen.add(key)
    }
  }

  return problems
}
