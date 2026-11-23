import type { Project, ProjectPermissions } from '@comfyorg/ingest-types'

export function projectPermission<K extends keyof ProjectPermissions>(
  project: Project | null | undefined,
  key: K
): ProjectPermissions[K] {
  return project?.permissions[key]
}

export function projectRoleLabelKey(project: Project) {
  if (project.is_default) return 'projectSwitcher.defaultProject' as const
  if (project.my_role === 'runner') {
    return 'projectSwitcher.role.runner' as const
  }
  if (project.my_role === 'builder') {
    return 'projectSwitcher.role.builder' as const
  }
  if (project.my_role === 'project_admin') {
    return 'projectSwitcher.role.projectAdmin' as const
  }
  return 'projectSwitcher.role.owner' as const
}
