export type WorkflowCreditsGate = 'run' | 'noCredits' | 'memberNoCredits'

export interface WorkflowCreditsRefusal {
  readonly credits: number | undefined
}

export function withRefusalBaseline(
  refusal: WorkflowCreditsRefusal | undefined,
  credits: number | undefined
): WorkflowCreditsRefusal | undefined {
  return refusal && refusal.credits === undefined && credits !== undefined
    ? { credits }
    : refusal
}

export function workflowCreditsGate({
  busy,
  member,
  credits,
  refusal
}: {
  busy: boolean
  member: boolean
  credits: number | undefined
  refusal: WorkflowCreditsRefusal | undefined
}): WorkflowCreditsGate {
  const empty = credits !== undefined && credits <= 0
  const notToppedUp =
    refusal !== undefined &&
    (credits === undefined ||
      refusal.credits === undefined ||
      credits <= refusal.credits)
  if (busy || !(empty || notToppedUp)) return 'run'
  return member ? 'memberNoCredits' : 'noCredits'
}
