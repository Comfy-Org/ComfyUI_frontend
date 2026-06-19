export type AppMode =
  | 'graph'
  | 'app'
  | 'builder:inputs'
  | 'builder:outputs'
  | 'builder:arrange'

type WorkflowModeSource = {
  activeMode: AppMode | null
  initialMode: AppMode | null | undefined
}

export function getWorkflowMode(
  workflow: WorkflowModeSource | null | undefined
): AppMode {
  return workflow?.activeMode ?? workflow?.initialMode ?? 'graph'
}

export function isAppModeValue(mode: AppMode): boolean {
  return mode === 'app' || mode === 'builder:arrange'
}
