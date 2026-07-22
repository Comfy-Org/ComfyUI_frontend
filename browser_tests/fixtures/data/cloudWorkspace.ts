import type {
  BillingStatusResponse,
  Member,
  Plan,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'
import type { RemoteConfig } from '@/platform/remoteConfig/types'

// `/api/features` is the remote-config source: production builds resolve the
// workspaces flag from it (the `ff:` localStorage override is dev-only).
export const WORKSPACE_FEATURE_FLAG: RemoteConfig = {
  team_workspaces_enabled: true,
  billing_control_enabled: true,
  consolidated_billing_enabled: true
}

export const TEAM_WORKSPACE: WorkspaceWithRole = {
  id: 'ws-team',
  name: 'Team Comfy',
  type: 'team',
  created_at: '2025-01-01T00:00:00Z',
  joined_at: '2025-01-02T00:00:00Z',
  role: 'owner',
  subscription_tier: 'PRO'
}

export const CREATOR: Member = {
  id: 'u-liz',
  name: 'Liz',
  email: 'liz@test.comfy.org',
  joined_at: '2025-01-01T00:00:00Z',
  role: 'owner',
  is_original_owner: true
}

// Identity must match the CloudAuthHelper mock user so this row counts as
// "(You)".
export const VIEWER: Member = {
  id: 'u-me',
  name: 'E2E Test User',
  email: 'e2e@test.comfy.org',
  joined_at: '2025-01-02T00:00:00Z',
  role: 'owner',
  is_original_owner: false
}

export const MEMBER_JANE: Member = {
  id: 'u-jane',
  name: 'Jane',
  email: 'jane@test.comfy.org',
  joined_at: '2025-01-03T00:00:00Z',
  role: 'member',
  is_original_owner: false
}

export const MEMBER_JOHN: Member = {
  id: 'u-john',
  name: 'John',
  email: 'john@test.comfy.org',
  joined_at: '2025-01-04T00:00:00Z',
  role: 'member',
  is_original_owner: false
}

export const DEFAULT_TEAM_MEMBERS: Member[] = [
  CREATOR,
  VIEWER,
  MEMBER_JANE,
  MEMBER_JOHN
]

const TEAM_PLAN_SLUG = 'team-pro-monthly'

export const TEAM_BILLING_STATUS: BillingStatusResponse = {
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  plan_slug: TEAM_PLAN_SLUG,
  billing_status: 'paid',
  has_funds: true,
  renewal_date: '2099-02-20T00:00:00Z'
}

export const TEAM_PRO_PLAN: Plan = {
  slug: TEAM_PLAN_SLUG,
  tier: 'PRO',
  duration: 'MONTHLY',
  price_cents: 10000,
  credits_cents: 21100,
  max_seats: 30,
  availability: { available: true },
  seat_summary: {
    seat_count: 4,
    total_cost_cents: 40000,
    total_credits_cents: 0
  }
}
