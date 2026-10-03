interface ProjectedNodeIdentity {
  type: string
  title?: string
}

interface MaterializedNodeIdentity {
  type: string
  hasErrors: boolean
}

export function assertAgentReplayNodeContract(
  projected: ProjectedNodeIdentity,
  registeredDisplayName: string | undefined,
  materialized: MaterializedNodeIdentity | null
): string {
  const expectedTitle =
    projected.title || registeredDisplayName || projected.type
  if (materialized === null) {
    throw new Error(`Agent replay did not materialize ${projected.type}`)
  }
  if (materialized.type !== projected.type) {
    throw new Error(
      `Agent replay materialized ${materialized.type} instead of ${projected.type}`
    )
  }
  if (materialized.hasErrors) {
    throw new Error(
      `Agent replay materialized ${projected.type} as a missing-node placeholder`
    )
  }
  return expectedTitle
}
