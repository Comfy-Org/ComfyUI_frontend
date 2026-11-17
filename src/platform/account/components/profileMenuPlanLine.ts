import type {
  WorkspacePlanSummary,
  WorkspaceWithRole
} from '@comfyorg/ingest-types'

type PlanStatus = WorkspacePlanSummary['status']

const STATUS_KEY = {
  no_plan: 'profileMenu.planStatus.noPlan',
  paused: 'profileMenu.planStatus.paused',
  payment_due: 'profileMenu.planStatus.paymentDue',
  ended: 'profileMenu.planStatus.ended'
} as const satisfies Record<Exclude<PlanStatus, 'active'>, string>

/** The plan part of the menu header line: the served status, else the served plan name, else nothing. */
export function profileMenuPlanLabel(
  summary: WorkspacePlanSummary | undefined,
  translate: (key: string) => string
): string | null {
  if (!summary) return null
  if (summary.status === 'active') return summary.plan_name
  return translate(STATUS_KEY[summary.status])
}

/** i18n key for each served workspace role. */
export const PROFILE_MENU_ROLE_KEY = {
  owner: 'workspaceSwitcher.roleOwner',
  member: 'workspaceSwitcher.roleMember'
} as const satisfies Record<WorkspaceWithRole['role'], string>
