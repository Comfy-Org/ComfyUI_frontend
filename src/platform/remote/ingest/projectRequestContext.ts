export const PROJECT_ID_HEADER = 'X-Comfy-Project-ID'

let selectedProjectId: string | null = null

export function setSelectedProjectId(projectId: string | null): void {
  selectedProjectId = projectId
}

export function projectIdHeaders():
  | { [PROJECT_ID_HEADER]: string }
  | Record<string, never> {
  return selectedProjectId ? { [PROJECT_ID_HEADER]: selectedProjectId } : {}
}
