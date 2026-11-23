import type {
  ListProjectMembersResponse,
  ListProjectsResponse,
  Member,
  Project,
  ProjectMember,
  ProjectPermissions,
  ProjectQuota,
  ProjectRole
} from '@comfyorg/ingest-types'

const NOW = '2026-01-01T00:00:00Z'
const WORKSPACE_ID = 'workspace-1'

const runnerPermissions = {
  project: 'read',
  'project.assets': 'write_own',
  'project.members': 'read',
  'project.queue': 'write_own',
  'project.usage': 'read_own',
  'project.workflow': 'read'
} as const satisfies ProjectPermissions

const builderPermissions = {
  ...runnerPermissions,
  'project.workflow': 'write'
} as const satisfies ProjectPermissions

const adminPermissions = {
  project: 'write',
  'project.assets': 'write_all',
  'project.deployments': 'write',
  'project.members': 'write',
  'project.queue': 'write_all',
  'project.usage': 'read_all',
  'project.workflow': 'write'
} as const satisfies ProjectPermissions

function project(
  id: string,
  name: string,
  permissions: ProjectPermissions,
  extras: Partial<Project> = {}
): Project {
  return {
    id,
    name,
    workspace_id: WORKSPACE_ID,
    is_default: false,
    shared_cloud_allowed: true,
    writable: true,
    create_time: NOW,
    update_time: NOW,
    permissions,
    ...extras
  }
}

function member(
  userId: string,
  name: string,
  role: ProjectRole
): ProjectMember {
  return {
    user_id: userId,
    name,
    email: `${userId}@example.com`,
    role,
    create_time: NOW
  }
}

const quotaUnderLimit: ProjectQuota = {
  active: 1,
  max_active: 25,
  can_create: true
}

const quotaAtLimit: ProjectQuota = {
  active: 25,
  max_active: 25,
  can_create: false
}

function defaultProject(from: ProjectPermissions): Project {
  return project(
    'proj-default',
    'Default',
    {
      ...from,
      project: 'read',
      ...(from['project.members'] === 'write'
        ? { 'project.members': 'read' }
        : {})
    },
    { is_default: true }
  )
}

const projectAsRunner = project('proj-studio', 'Studio', runnerPermissions, {
  my_role: 'runner'
})

const projectAsBuilder = project('proj-studio', 'Studio', builderPermissions, {
  my_role: 'builder'
})

const projectAsProjectAdmin = project(
  'proj-studio',
  'Studio',
  adminPermissions,
  { my_role: 'project_admin' }
)

const projectAsWorkspaceAdmin = project(
  'proj-studio',
  'Studio',
  adminPermissions
)

export const projectAsOwner = project('proj-studio', 'Studio', adminPermissions)

export const frozenProject = project(
  'proj-frozen',
  'Archived campaign',
  adminPermissions,
  { writable: false, my_role: 'project_admin' }
)

export const projectMembers: ListProjectMembersResponse = {
  members: [
    member('user-runner', 'Rina Runner', 'runner'),
    member('user-builder', 'Bea Builder', 'builder'),
    member('user-project-admin', 'Pat Admin', 'project_admin')
  ]
}

const quotaMemberCannotCreate: ProjectQuota = {
  ...quotaUnderLimit,
  can_create: false
}

function listFor(viewed: Project, quota: ProjectQuota): ListProjectsResponse {
  return {
    projects: [defaultProject(viewed.permissions), viewed],
    projects_in_use: true,
    quota
  }
}

export const listProjectsByRole = {
  runner: listFor(projectAsRunner, quotaMemberCannotCreate),
  builder: listFor(projectAsBuilder, quotaMemberCannotCreate),
  projectAdmin: listFor(projectAsProjectAdmin, quotaMemberCannotCreate),
  workspaceAdmin: listFor(projectAsWorkspaceAdmin, quotaUnderLimit),
  owner: listFor(projectAsOwner, quotaUnderLimit)
} as const

export const listProjectsAtLimit: ListProjectsResponse = {
  projects: [defaultProject(adminPermissions), projectAsOwner, frozenProject],
  projects_in_use: true,
  quota: quotaAtLimit
}

export const workspaceMember: Member = {
  id: 'user-member',
  name: 'Ada Member',
  email: 'ada@example.com',
  role: 'member',
  is_original_owner: false,
  joined_at: NOW,
  workspace_admin: false
}

export const workspaceAdminMember: Member = {
  ...workspaceMember,
  workspace_admin: true
}
