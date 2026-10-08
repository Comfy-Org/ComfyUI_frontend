const PLAN_COLORS = {
  FREE: { lightness: 0.45, chroma: 0.016, hue: 240, hueRange: 0 },
  CREATOR: { lightness: 0.53, chroma: 0.085, hue: 210, hueRange: 14 },
  PRO: { lightness: 0.52, chroma: 0.14, hue: 295, hueRange: 14 },
  TEAM: { lightness: 0.52, chroma: 0.1, hue: 155, hueRange: 14 },
  ENTERPRISE: { lightness: 0.66, chroma: 0.16, hue: 345, hueRange: 12 }
} as const

type AvatarPlan = keyof typeof PLAN_COLORS

const NAME_VARIATIONS = [-1, -0.5, 0, 0.5, 1] as const

/** Solid Polar plan color for a workspace avatar; neutral when the tier is unavailable. */
export function workspaceAvatarStyle(
  workspaceName: string,
  subscriptionTier: string | null | undefined
): { backgroundColor?: string; color?: string } {
  if (subscriptionTier === undefined) return {}

  const plan = resolveAvatarPlan(subscriptionTier)
  const base = PLAN_COLORS[plan]
  const variation =
    NAME_VARIATIONS[nameHash(workspaceName) % NAME_VARIATIONS.length] ?? 0
  const lightnessStep = base.hueRange ? 0.025 : 0.055
  const lightness = (base.lightness + variation * lightnessStep).toFixed(3)
  const chroma = (base.chroma + variation * 0.006).toFixed(3)
  const hue = Math.round(base.hue + variation * base.hueRange)

  return {
    backgroundColor: `oklch(${lightness} ${chroma} ${hue})`,
    color:
      plan === 'ENTERPRISE' ? 'var(--color-charcoal-800)' : 'var(--color-white)'
  }
}

function resolveAvatarPlan(tier: string | null): AvatarPlan {
  if (tier === 'STANDARD' || tier === 'FOUNDERS_EDITION') return 'CREATOR'
  return tier && isAvatarPlan(tier) ? tier : 'FREE'
}

function isAvatarPlan(tier: string): tier is AvatarPlan {
  return Object.hasOwn(PLAN_COLORS, tier)
}

function nameHash(name: string): number {
  const characters = Array.from(name.normalize('NFKC').trim().toLowerCase())
  return (
    characters.reduce(
      (hash, character) =>
        Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16777619),
      2166136261
    ) >>> 0
  )
}
