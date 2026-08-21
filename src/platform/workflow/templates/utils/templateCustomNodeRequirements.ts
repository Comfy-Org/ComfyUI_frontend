import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

const requirementsField = 'requiresCustomNodes' satisfies keyof TemplateInfo

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

export function extractTemplateCustomNodeRequirements(
  template: unknown
): readonly string[] {
  if (!isRecord(template)) return []

  const requirements = template[requirementsField]
  if (!Array.isArray(requirements)) return []

  const seen = new Set<string>()
  return requirements.flatMap((requirement) => {
    if (typeof requirement !== 'string') return []

    const packageId = requirement.trim()
    if (!packageId || seen.has(packageId)) return []

    seen.add(packageId)
    return [packageId]
  })
}
