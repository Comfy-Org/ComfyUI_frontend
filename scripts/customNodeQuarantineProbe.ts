function diagnosticText(error: unknown): string {
  if (typeof error === 'string') return error
  if (typeof error !== 'object' || error === null) return String(error)
  const record = error as Record<string, unknown>
  return [record.message, record.stderr, record.stdout]
    .filter((value): value is string => typeof value === 'string')
    .join('\n')
}

export function provesRefIsMissing(error: unknown): boolean {
  return /(?:not our ref|couldn't find remote ref|unadvertised object)/i.test(
    diagnosticText(error)
  )
}

export function provesRequirementIsUnsatisfiable(
  error: unknown,
  expectedRequirement: string
): boolean {
  const diagnostic = diagnosticText(error)
  return (
    diagnostic.includes(expectedRequirement) &&
    /(?:Could not find a version that satisfies the requirement|No matching distribution found|ResolutionImpossible)/i.test(
      diagnostic
    )
  )
}
