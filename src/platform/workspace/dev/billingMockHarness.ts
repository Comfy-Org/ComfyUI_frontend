/**
 * Billing Rework V1 — in-app mock harness (PREVIEW ONLY).
 *
 * ⚠️ Lives on the FE-991 integration/preview branch only — DO NOT MERGE to main.
 *
 * Lets anyone exercise every billing/workspace UX variation on the preview
 * deployment without Tampermonkey/CDP. It is the userscript
 * (`.claude/skills/billing-v1-verify/assets/billing-mock.user.js`) ported into
 * the app, plus the two things needed to work in a PRODUCTION preview build:
 *
 *  1. `ff:` dev overrides are stripped from prod builds, so the team-workspaces
 *     flag cannot be flipped via localStorage. Instead we intercept
 *     `/api/features`, pass the real response through, and merge only
 *     `team_workspaces_enabled: true` — preserving `firebase_config` so auth
 *     does NOT break (faking the whole response logs the user out).
 *  2. Billing/workspace endpoints (axios → XHR) are served canned responses.
 *
 * Inert unless opted in with `?billingmock` (or once activated, the
 * `cbm.active` localStorage key). The floating panel is draggable + collapsible
 * and persists scenario + position across the save+reload it triggers.
 */
import { useAuthStore } from '@/stores/authStore'

const LS = 'comfyBillingMock'
const LS_UI = 'cbm_ui'
const ACTIVE_KEY = 'cbm.active'

type Workspace = 'personal' | 'team'
type Role = 'owner' | 'member'

// Real signed-in email so 'owner' can make the current user the creator (the
// original-owner check matches the earliest member's email to the current user).
function currentUserEmail(): string {
  try {
    return useAuthStore().userEmail ?? 'you@comfy.org'
  } catch {
    return 'you@comfy.org'
  }
}
type Tier = 'free' | 'standard' | 'creator' | 'pro' | 'enterprise'
type State =
  | 'active'
  | 'cancelled'
  | 'inactive'
  | 'changing'
  | 'at_risk'
  | 'paused'
// 'full' = fresh cycle, monthly credits reset, nobody has used anything (all
// member usage is 0); 'partial' = members have used some of the monthly allotment.
type Balance = 'full' | 'partial' | 'low' | 'empty'

// Mirrors AutoReloadScenario in useAutoReload.ts (kept as a plain union here so
// the dev harness doesn't import app code).
type AutoReload =
  | 'notset'
  | 'nobudget'
  | 'healthy'
  | 'nearlimit'
  | 'paused'
  | 'off'

interface MockCfg {
  ws: Workspace
  role: Role
  tier: Tier
  state: State
  balance: Balance
  roleChange: '200' | '500'
  multiWs: boolean
  autoReload: AutoReload
}

interface UiState {
  left?: number
  top?: number
  collapsed?: boolean
}

const DEFAULTS: MockCfg = {
  ws: 'team',
  role: 'owner',
  tier: 'creator',
  state: 'active',
  balance: 'partial',
  roleChange: '200',
  multiWs: false,
  autoReload: 'healthy'
}

const cfg: MockCfg = { ...DEFAULTS }

// Allowed values per enum field, shared by the picker and by loadCfg's
// validation so a persisted value that's no longer valid (e.g. after renaming
// 'funded' → 'full') is dropped rather than silently desyncing the picker.
const OPTIONS: Record<
  'ws' | 'role' | 'tier' | 'state' | 'balance' | 'roleChange' | 'autoReload',
  string[]
> = {
  ws: ['personal', 'team'],
  role: ['owner', 'member'],
  tier: ['free', 'standard', 'creator', 'pro', 'enterprise'],
  state: ['active', 'cancelled', 'inactive', 'changing', 'at_risk', 'paused'],
  balance: ['full', 'partial', 'low', 'empty'],
  roleChange: ['200', '500'],
  autoReload: ['notset', 'nobudget', 'healthy', 'nearlimit', 'paused', 'off']
}

function loadCfg(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || '{}') as Record<
      string,
      unknown
    >
    for (const [key, opts] of Object.entries(OPTIONS)) {
      const value = saved[key]
      if (typeof value === 'string' && !opts.includes(value)) delete saved[key]
    }
    Object.assign(cfg, saved)
  } catch {
    /* ignore */
  }
}
function saveCfg(): void {
  localStorage.setItem(LS, JSON.stringify(cfg))
  // Auto-reload has no API, so useAutoReload reads its scenario straight from
  // this dedicated key rather than an intercepted response.
  localStorage.setItem('cbm.autoReload', cfg.autoReload)
}
function loadUi(): UiState {
  try {
    return JSON.parse(localStorage.getItem(LS_UI) || '{}') as UiState
  } catch {
    return {}
  }
}
function saveUi(ui: UiState): void {
  localStorage.setItem(LS_UI, JSON.stringify(ui))
}

// ---- reference data (mirrors tierPricing.ts) -------------------------------
const TIER: Record<Tier, string> = {
  free: 'FREE',
  standard: 'STANDARD',
  creator: 'CREATOR',
  pro: 'PRO',
  enterprise: 'ENTERPRISE'
}
// [price_cents, credits] per personal tier (monthly). Enterprise is a team-level
// plan whose credits come from team_credit_stop, so this row is only a benign
// placeholder for the change-plan preview path.
const PRICING: Record<Tier, [number, number]> = {
  free: [0, 0],
  standard: [2000, 4200],
  creator: [3500, 7400],
  pro: [10000, 21100],
  enterprise: [10000, 21100]
}
// Team monthly credit allotment (credit_stop.credits_monthly). The CreditsTile
// derives "used of total" from this, so balances below are expressed as credit
// counts relative to it, not raw micros.
const TEAM_MONTHLY_CREDITS = 56_900

// Balance *_micros fields are actually cents; credits = cents * CREDITS_PER_USD /
// 100, so cents = round(credits * 100 / 211).
const creditsToCents = (credits: number) => Math.round((credits * 100) / 211)

// [monthly credits remaining, prepaid/additional credits] per balance state.
const BALANCE_CREDITS: Record<Balance, [number, number]> = {
  full: [TEAM_MONTHLY_CREDITS, 12_000], // 0% of monthly used
  partial: [Math.round(TEAM_MONTHLY_CREDITS / 2), 8_000], // ~50% used
  low: [0, 1_500], // monthly exhausted, sliver of prepaid left
  empty: [0, 0]
}
const FUTURE = '2099-02-20T00:00:00Z'
const CANCEL_AT = '2099-03-01T00:00:00Z'

// ---- response builders -----------------------------------------------------
const slug = (t: Tier) => `${t}-monthly`

function workspaces(): unknown {
  // created_at/joined_at are required: sortWorkspaces() compares them via
  // .localeCompare, so omitting them throws once there is >1 workspace (the
  // real API always sends both).
  const active =
    cfg.ws === 'personal'
      ? {
          id: 'ws-active',
          name: 'Personal Workspace',
          type: 'personal',
          role: 'owner',
          created_at: '2026-01-01T00:00:00Z',
          joined_at: '2026-01-01T00:00:00Z'
        }
      : {
          id: 'ws-active',
          name: 'My Team',
          type: 'team',
          role: cfg.role === 'member' ? 'member' : 'owner',
          subscription_tier: TIER[cfg.tier],
          created_at: '2026-01-01T00:00:00Z',
          joined_at: '2026-01-01T00:00:00Z'
        }
  const list: unknown[] = [active]
  if (cfg.multiWs)
    list.push({
      id: 'ws-other',
      name: 'Acme Studio Workspace — long name to test truncation',
      type: 'team',
      role: 'member',
      created_at: '2026-02-01T00:00:00Z',
      joined_at: '2026-02-01T00:00:00Z'
    })
  return { workspaces: list }
}

const subStatus = () =>
  ({
    active: 'active',
    cancelled: 'canceled',
    inactive: 'ended',
    changing: 'scheduled',
    at_risk: 'active',
    paused: 'paused'
  })[cfg.state]

// TEAM — /api/billing/status (has_funds, cancel_at)
function billingStatus(): unknown {
  return {
    is_active: cfg.state !== 'inactive',
    has_funds: cfg.balance !== 'empty' && cfg.state !== 'paused',
    subscription_status: subStatus(),
    subscription_tier: TIER[cfg.tier],
    subscription_duration: 'MONTHLY',
    plan_slug: slug(cfg.tier),
    billing_status:
      cfg.state === 'inactive'
        ? 'inactive'
        : cfg.state === 'at_risk' || cfg.state === 'paused'
          ? 'payment_failed'
          : 'paid',
    renewal_date: FUTURE,
    cancel_at: cfg.state === 'cancelled' ? CANCEL_AT : undefined,
    // Presence marks a new credit-slider team plan (vs. legacy) and gives the
    // CreditsTile a team-scale monthly total to measure usage against.
    team_credit_stop: {
      id: 'team-stop-1',
      credits_monthly: TEAM_MONTHLY_CREDITS,
      stop_usd: 500
    }
  }
}

// PERSONAL — /customers/cloud-subscription-status (has_fund singular, end_date)
function legacyStatus(): unknown {
  return {
    is_active: cfg.state !== 'inactive',
    subscription_id: 'sub_mock',
    subscription_tier: TIER[cfg.tier],
    subscription_duration: 'MONTHLY',
    has_fund: cfg.balance !== 'empty',
    renewal_date: FUTURE,
    end_date: cfg.state === 'cancelled' ? CANCEL_AT : null
  }
}

function balance(): unknown {
  const [monthlyCredits, prepaidCredits] =
    cfg.state === 'paused'
      ? [0, 0]
      : BALANCE_CREDITS[cfg.balance] || BALANCE_CREDITS.full
  const cloud = creditsToCents(monthlyCredits)
  const prepaid = creditsToCents(prepaidCredits)
  const total = cloud + prepaid
  return {
    amount_micros: total,
    currency: 'usd',
    effective_balance_micros: total,
    cloud_credit_balance_micros: cloud,
    prepaid_balance_micros: prepaid
  }
}

function plan(t: Tier, current: boolean): unknown {
  const p = PRICING[t]
  return {
    slug: slug(t),
    tier: TIER[t],
    duration: 'MONTHLY',
    price_cents: p[0],
    credits_cents: p[1],
    max_seats: t === 'pro' ? 20 : t === 'creator' ? 5 : 1,
    availability: {
      available: true,
      reason: current ? 'same_plan' : undefined
    },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: p[0],
      total_credits_cents: p[1]
    }
  }
}

function plans(): unknown {
  const keys: Tier[] = ['standard', 'creator', 'pro']
  return {
    current_plan_slug: cfg.tier === 'free' ? undefined : slug(cfg.tier),
    plans: keys.map((t) => plan(t, t === cfg.tier))
  }
}

function preview(): unknown {
  const p = PRICING[cfg.tier]
  return {
    allowed: true,
    transition_type: 'new_subscription',
    effective_at: FUTURE,
    is_immediate: true,
    cost_today_cents: p[0],
    cost_next_period_cents: p[0],
    credits_today_cents: p[1],
    credits_next_period_cents: p[1],
    new_plan: {
      slug: slug(cfg.tier),
      tier: TIER[cfg.tier],
      duration: 'MONTHLY',
      price_cents: p[0],
      credits_cents: p[1],
      seat_summary: {
        seat_count: 1,
        total_cost_cents: p[0],
        total_credits_cents: p[1]
      }
    }
  }
}

function subscribeResp(): unknown {
  return {
    billing_op_id: 'op-1',
    status: 'subscribed'
  }
}

const opStatus = () => ({
  id: 'op-1',
  status: 'succeeded',
  started_at: '2026-01-01T00:00:00Z',
  completed_at: '2026-01-01T00:01:00Z'
})

function members(): unknown {
  const hoursAgo = (h: number) =>
    new Date(Date.now() - h * 60 * 60 * 1000).toISOString()
  const me = currentUserEmail()
  // Nobody has spent anything in a fresh cycle, so member usage is 0.
  const usage = (n: number) => (cfg.balance === 'full' ? 0 : n)
  // 'owner' → the current user IS the creator; otherwise the creator is someone
  // else and the current user is injected as a non-original owner/member below.
  const creator = {
    id: 'user-creator',
    name: cfg.role === 'owner' ? 'You (creator)' : 'Original Owner',
    email: cfg.role === 'owner' ? me : 'you@comfy.org',
    joined_at: '2026-01-01T00:00:00Z',
    role: 'owner',
    is_original_owner: true,
    last_active_at: hoursAgo(2),
    credits_used_this_month: usage(546),
    monthly_credit_limit: 3000
  }
  const selfRow =
    cfg.role === 'owner'
      ? []
      : [
          {
            id: 'user-self',
            name: 'You',
            email: me,
            joined_at: '2026-01-05T00:00:00Z',
            role: 'member',
            is_original_owner: false,
            last_active_at: hoursAgo(1),
            credits_used_this_month: usage(1234)
          }
        ]
  // A long roster so the table overflows and scrolls under its sticky header.
  const names = [
    'Jane Doe',
    'Rob Johnson',
    'Min Lee',
    'Yuta Tanaka',
    'Alice Martin',
    'Bob Ferreira',
    'Priya Nair',
    'Diego Alvarez',
    'Mei Chen',
    'Sam Okafor',
    'Lena Vogt',
    'Tomás Silva',
    'Aisha Khan',
    'Noah Weber',
    'Sofia Rossi',
    'Kenji Sato',
    'Ivy Nguyen',
    'Omar Haddad',
    'Clara Boyd',
    'Ravi Iyer',
    'Hana Kim',
    'Leo Fischer',
    'Zara Ahmed',
    'Marco Bianchi',
    'Nadia Petrova',
    'Eli Brooks',
    'Yara Costa'
  ]
  const team = names.map((name, i) => ({
    id: `user-${100 + i}`,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
    joined_at: '2026-02-15T00:00:00Z',
    role: i % 3 === 0 ? 'owner' : 'member',
    is_original_owner: false,
    last_active_at: hoursAgo([0.1, 2, 7, 23, 24, 72, 120][i % 7]),
    credits_used_this_month: usage(
      i === 2 ? 5400 : [15, 140, 320, 1025, 2586, 88, 1740, 6][i % 7] * (i + 1)
    ),
    monthly_credit_limit: i < 3 ? [3000, 2500, 5000][i] : null
  }))
  const list = cfg.ws === 'team' ? [creator, ...selfRow, ...team] : [creator]
  return {
    members: list,
    pagination: { offset: 0, limit: 10, total: list.length }
  }
}

const createInvite = () => ({
  id: 'inv-1',
  email: 'newhire@example.com',
  token: 'tok-123',
  invited_at: '2026-06-01T00:00:00Z',
  expires_at: '2026-06-08T00:00:00Z'
})

function pendingInvites(): unknown {
  if (cfg.ws !== 'team') return { invites: [] }
  const daysFromNow = (d: number) =>
    new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString()
  return {
    invites: [
      {
        id: 'inv-1',
        email: 'newhire@example.com',
        token: 'tok-1',
        invited_at: daysFromNow(-2),
        expires_at: daysFromNow(5)
      },
      {
        id: 'inv-2',
        email: 'contractor@studio.com',
        token: 'tok-2',
        invited_at: daysFromNow(-5),
        expires_at: daysFromNow(2)
      }
    ]
  }
}

// Partner node governance (V1). Canned list; toggles are optimistic client-side
// so they hold within a session but reset on reload.
function partnerNodes(): unknown {
  return {
    auto_enable_new: true,
    partner_nodes: [
      {
        id: 'pn-1',
        name: 'Anthropic Claude',
        partner: 'Anthropic',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-2',
        name: 'Beeble SwitchX Image Edit',
        partner: 'Beeble',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-3',
        name: 'Beeble SwitchX Video Edit',
        partner: 'Beeble',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-4',
        name: 'Flux 1.1 [pro] Ultra Image',
        partner: 'BFL',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-5',
        name: 'Flux Erase Image',
        partner: 'BFL',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-6',
        name: 'Flux Virtual Try-On',
        partner: 'BFL',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-7',
        name: 'Flux.1 Expand Image',
        partner: 'BFL',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-8',
        name: 'Flux.1 Fill Image',
        partner: 'BFL',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-9',
        name: 'Flux.1 Kontext [max] Image',
        partner: 'BFL',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-10',
        name: 'Flux.1 Kontext [pro] Image',
        partner: 'BFL',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-11',
        name: 'Flux.2 [max] Image',
        partner: 'BFL',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-12',
        name: 'Flux.2 [pro] Image',
        partner: 'BFL',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-13',
        name: 'Flux.2 Image',
        partner: 'BFL',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-14',
        name: 'Bria FIBO Image Edit',
        partner: 'Bria',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-15',
        name: 'Bria Remove Image Background',
        partner: 'Bria',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-16',
        name: 'Bria Remove Video Background',
        partner: 'Bria',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-17',
        name: 'Bria Remove Video Background (Transparent)',
        partner: 'Bria',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-18',
        name: 'Bria Video Green Screen',
        partner: 'Bria',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-19',
        name: 'Bria Video Replace Background',
        partner: 'Bria',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-20',
        name: 'ByteDance First-Last-Frame to Video',
        partner: 'ByteDance',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-21',
        name: 'ByteDance Image',
        partner: 'ByteDance',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-22',
        name: 'ByteDance Image to Video',
        partner: 'ByteDance',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-23',
        name: 'ByteDance Reference Images to Video',
        partner: 'ByteDance',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-24',
        name: 'ByteDance Seed',
        partner: 'ByteDance',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-25',
        name: 'ByteDance Seedance 2.0 First-Last-Frame to Video',
        partner: 'ByteDance',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-26',
        name: 'ByteDance Seedance 2.0 Reference to Video',
        partner: 'ByteDance',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-27',
        name: 'ByteDance Seedance 2.0 Text to Video',
        partner: 'ByteDance',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-28',
        name: 'ByteDance Seedream 4.5 & 5.0',
        partner: 'ByteDance',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-29',
        name: 'ByteDance Text to Video',
        partner: 'ByteDance',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-30',
        name: 'ElevenLabs Instant Voice Clone',
        partner: 'ElevenLabs',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-31',
        name: 'ElevenLabs Speech to Speech',
        partner: 'ElevenLabs',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-32',
        name: 'ElevenLabs Speech to Text',
        partner: 'ElevenLabs',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-33',
        name: 'ElevenLabs Text to Dialogue',
        partner: 'ElevenLabs',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-34',
        name: 'ElevenLabs Text to Sound Effects',
        partner: 'ElevenLabs',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-35',
        name: 'ElevenLabs Text to Speech',
        partner: 'ElevenLabs',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-36',
        name: 'ElevenLabs Voice Isolation',
        partner: 'ElevenLabs',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-37',
        name: 'Google Gemini',
        partner: 'Gemini',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-38',
        name: 'Google Gemini Omni (Video)',
        partner: 'Gemini',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-39',
        name: 'Nano Banana (Google Gemini Image)',
        partner: 'Gemini',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-40',
        name: 'Nano Banana 2',
        partner: 'Gemini',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-41',
        name: 'Nano Banana Pro (Google Gemini Image)',
        partner: 'Gemini',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-42',
        name: 'Grok Image',
        partner: 'Grok',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-43',
        name: 'Grok Image Edit',
        partner: 'Grok',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-44',
        name: 'Grok Reference-to-Video',
        partner: 'Grok',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-45',
        name: 'Grok Video',
        partner: 'Grok',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-46',
        name: 'Grok Video Edit',
        partner: 'Grok',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-47',
        name: 'Grok Video Extend',
        partner: 'Grok',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-48',
        name: 'HitPaw General Image Enhance',
        partner: 'HitPaw',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-49',
        name: 'HitPaw Video Enhance',
        partner: 'HitPaw',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-50',
        name: 'Ideogram V1',
        partner: 'Ideogram',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-51',
        name: 'Ideogram V2',
        partner: 'Ideogram',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-52',
        name: 'Ideogram V3',
        partner: 'Ideogram',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-53',
        name: 'Ideogram V4',
        partner: 'Ideogram',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-54',
        name: 'Kling 2.6 Image(First Frame) to Video with Audio',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-55',
        name: 'Kling 2.6 Text to Video with Audio',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-56',
        name: 'Kling 3.0 First-Last-Frame to Video',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-57',
        name: 'Kling 3.0 Image',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-58',
        name: 'Kling 3.0 Omni Edit Video',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-59',
        name: 'Kling 3.0 Omni First-Last-Frame to Video',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-60',
        name: 'Kling 3.0 Omni Image',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-61',
        name: 'Kling 3.0 Omni Image to Video',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-62',
        name: 'Kling 3.0 Omni Text to Video',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-63',
        name: 'Kling 3.0 Omni Video to Video',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-64',
        name: 'Kling 3.0 Video',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-65',
        name: 'Kling Avatar 2.0',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-66',
        name: 'Kling Dual Character Video Effects',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-67',
        name: 'Kling Image to Video (Camera Control)',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-68',
        name: 'Kling Image(First Frame) to Video',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-69',
        name: 'Kling Lip Sync Video with Audio',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-70',
        name: 'Kling Lip Sync Video with Text',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-71',
        name: 'Kling Motion Control',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-72',
        name: 'Kling Start-End Frame to Video',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-73',
        name: 'Kling Text to Video',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-74',
        name: 'Kling Text to Video (Camera Control)',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-75',
        name: 'Kling Video Effects',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-76',
        name: 'Kling Video Extend',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-77',
        name: 'Kling Virtual Try On',
        partner: 'Kling',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-78',
        name: 'Krea 2 Image',
        partner: 'Krea',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-79',
        name: 'LTXV Image To Video',
        partner: 'LTXV',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-80',
        name: 'LTXV Text To Video',
        partner: 'LTXV',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-81',
        name: 'Luma Image to Image',
        partner: 'Luma',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-82',
        name: 'Luma Image to Video',
        partner: 'Luma',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-83',
        name: 'Luma Ray 3.2 Extend Video',
        partner: 'Luma',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-84',
        name: 'Luma Ray 3.2 Image to Video',
        partner: 'Luma',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-85',
        name: 'Luma Ray 3.2 Keyframes to Video',
        partner: 'Luma',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-86',
        name: 'Luma Ray 3.2 Text to Video',
        partner: 'Luma',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-87',
        name: 'Luma Ray 3.2 Video Edit',
        partner: 'Luma',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-88',
        name: 'Luma Ray 3.2 Video Reframe',
        partner: 'Luma',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-89',
        name: 'Luma Text to Image',
        partner: 'Luma',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-90',
        name: 'Luma Text to Video',
        partner: 'Luma',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-91',
        name: 'Luma UNI-1 Image',
        partner: 'Luma',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-92',
        name: 'Luma UNI-1 Image Edit',
        partner: 'Luma',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-93',
        name: 'Magnific Image Relight',
        partner: 'Magnific',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-94',
        name: 'Magnific Image Skin Enhancer',
        partner: 'Magnific',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-95',
        name: 'Magnific Image Style Transfer',
        partner: 'Magnific',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-96',
        name: 'Magnific Image Upscale (Creative)',
        partner: 'Magnific',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-97',
        name: 'Magnific Image Upscale (Precise V2)',
        partner: 'Magnific',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-98',
        name: 'Meshy: Animate Model',
        partner: 'Meshy',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-99',
        name: 'Meshy: Image to Model',
        partner: 'Meshy',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-100',
        name: 'Meshy: Multi-Image to Model',
        partner: 'Meshy',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-101',
        name: 'Meshy: Refine Draft Model',
        partner: 'Meshy',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-102',
        name: 'Meshy: Rig Model',
        partner: 'Meshy',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-103',
        name: 'Meshy: Text to Model',
        partner: 'Meshy',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-104',
        name: 'Meshy: Texture Model',
        partner: 'Meshy',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-105',
        name: 'MiniMax Hailuo Video',
        partner: 'MiniMax',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-106',
        name: 'MiniMax Image to Video',
        partner: 'MiniMax',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-107',
        name: 'MiniMax Text to Video',
        partner: 'MiniMax',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-108',
        name: 'OpenAI ChatGPT',
        partner: 'OpenAI',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-109',
        name: 'OpenAI DALL·E 2',
        partner: 'OpenAI',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-110',
        name: 'OpenAI DALL·E 3',
        partner: 'OpenAI',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-111',
        name: 'OpenAI GPT Image 2',
        partner: 'OpenAI',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-112',
        name: 'OpenRouter LLM',
        partner: 'OpenRouter',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-113',
        name: 'PixVerse Image to Video',
        partner: 'PixVerse',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-114',
        name: 'PixVerse Text to Video',
        partner: 'PixVerse',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-115',
        name: 'PixVerse Transition Video',
        partner: 'PixVerse',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-116',
        name: 'Quiver Image to SVG',
        partner: 'Quiver',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-117',
        name: 'Quiver Text to SVG',
        partner: 'Quiver',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-118',
        name: 'Recraft Create Style',
        partner: 'Recraft',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-119',
        name: 'Recraft Creative Upscale Image',
        partner: 'Recraft',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-120',
        name: 'Recraft Crisp Upscale Image',
        partner: 'Recraft',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-121',
        name: 'Recraft Image Inpainting',
        partner: 'Recraft',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-122',
        name: 'Recraft Image to Image',
        partner: 'Recraft',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-123',
        name: 'Recraft Remove Background',
        partner: 'Recraft',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-124',
        name: 'Recraft Replace Background',
        partner: 'Recraft',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-125',
        name: 'Recraft Text to Image',
        partner: 'Recraft',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-126',
        name: 'Recraft Text to Vector',
        partner: 'Recraft',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-127',
        name: 'Recraft V4 Text to Image',
        partner: 'Recraft',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-128',
        name: 'Recraft V4 Text to Vector',
        partner: 'Recraft',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-129',
        name: 'Recraft Vectorize Image',
        partner: 'Recraft',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-130',
        name: 'Reve Image Create',
        partner: 'Reve',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-131',
        name: 'Reve Image Edit',
        partner: 'Reve',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-132',
        name: 'Reve Image Remix',
        partner: 'Reve',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-133',
        name: 'Rodin 3D Gen-2.5 - Image to 3D',
        partner: 'Rodin',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-134',
        name: 'Rodin 3D Gen-2.5 - Text to 3D',
        partner: 'Rodin',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-135',
        name: 'Rodin 3D Generate - Detail Generate',
        partner: 'Rodin',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-136',
        name: 'Rodin 3D Generate - Gen-2 Generate',
        partner: 'Rodin',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-137',
        name: 'Rodin 3D Generate - Regular Generate',
        partner: 'Rodin',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-138',
        name: 'Rodin 3D Generate - Sketch Generate',
        partner: 'Rodin',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-139',
        name: 'Rodin 3D Generate - Smooth Generate',
        partner: 'Rodin',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-140',
        name: 'Runway Aleph2 Video to Video',
        partner: 'Runway',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-141',
        name: 'Runway First-Last-Frame to Video',
        partner: 'Runway',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-142',
        name: 'Runway Image to Video (Gen3a Turbo)',
        partner: 'Runway',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-143',
        name: 'Runway Image to Video (Gen4 Turbo)',
        partner: 'Runway',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-144',
        name: 'Runway Text to Image',
        partner: 'Runway',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-145',
        name: 'Sonilo Text to Music',
        partner: 'Sonilo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-146',
        name: 'Sonilo Video to Music',
        partner: 'Sonilo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-147',
        name: 'OpenAI Sora - Video (DEPRECATED)',
        partner: 'Sora',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-148',
        name: 'Stability AI Audio Inpaint',
        partner: 'Stability AI',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-149',
        name: 'Stability AI Audio To Audio',
        partner: 'Stability AI',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-150',
        name: 'Stability AI Stable Diffusion 3.5 Image',
        partner: 'Stability AI',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-151',
        name: 'Stability AI Stable Image Ultra',
        partner: 'Stability AI',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-152',
        name: 'Stability AI Text To Audio',
        partner: 'Stability AI',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-153',
        name: 'Stability AI Upscale Conservative',
        partner: 'Stability AI',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-154',
        name: 'Stability AI Upscale Creative',
        partner: 'Stability AI',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-155',
        name: 'Stability AI Upscale Fast',
        partner: 'Stability AI',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-156',
        name: 'Hunyuan3D: 3D Part',
        partner: 'Tencent',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-157',
        name: 'Hunyuan3D: 3D Texture Edit',
        partner: 'Tencent',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-158',
        name: 'Hunyuan3D: Image(s) to Model',
        partner: 'Tencent',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-159',
        name: 'Hunyuan3D: Model to UV',
        partner: 'Tencent',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-160',
        name: 'Hunyuan3D: Smart Topology',
        partner: 'Tencent',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-161',
        name: 'Hunyuan3D: Text to Model',
        partner: 'Tencent',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-162',
        name: 'Topaz Image Enhance',
        partner: 'Topaz',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-163',
        name: 'Topaz Video Enhance',
        partner: 'Topaz',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-164',
        name: 'Topaz Video Enhance (Legacy)',
        partner: 'Topaz',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-165',
        name: 'Tripo P1: Image to Model',
        partner: 'Tripo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-166',
        name: 'Tripo P1: Multiview to Model',
        partner: 'Tripo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-167',
        name: 'Tripo P1: Text to Model',
        partner: 'Tripo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-168',
        name: 'Tripo: Convert model',
        partner: 'Tripo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-169',
        name: 'Tripo: Image to Model',
        partner: 'Tripo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-170',
        name: 'Tripo: Import Model',
        partner: 'Tripo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-171',
        name: 'Tripo: Multiview to Model',
        partner: 'Tripo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-172',
        name: 'Tripo: Refine Draft model',
        partner: 'Tripo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-173',
        name: 'Tripo: Retarget rigged model',
        partner: 'Tripo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-174',
        name: 'Tripo: Rig model',
        partner: 'Tripo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-175',
        name: 'Tripo: Text to Model',
        partner: 'Tripo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-176',
        name: 'Tripo: Texture model',
        partner: 'Tripo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-177',
        name: 'Google Veo 2 Video Generation',
        partner: 'Veo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-178',
        name: 'Google Veo 3 First-Last-Frame to Video',
        partner: 'Veo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-179',
        name: 'Google Veo 3 Video Generation',
        partner: 'Veo',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-180',
        name: 'Vidu Image To Video Generation',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-181',
        name: 'Vidu Multi-Frame Video Generation',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-182',
        name: 'Vidu Q3 Image-to-Video Generation',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-183',
        name: 'Vidu Q3 Start/End Frame-to-Video Generation',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-184',
        name: 'Vidu Q3 Text-to-Video Generation',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-185',
        name: 'Vidu Reference To Video Generation',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-186',
        name: 'Vidu Start End To Video Generation',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-187',
        name: 'Vidu Text To Video Generation',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-188',
        name: 'Vidu Video Extension',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-189',
        name: 'Vidu2 Image-to-Video Generation',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-190',
        name: 'Vidu2 Reference-to-Video Generation',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-191',
        name: 'Vidu2 Start/End Frame-to-Video Generation',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-192',
        name: 'Vidu2 Text-to-Video Generation',
        partner: 'Vidu',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-193',
        name: 'HappyHorse Image to Video',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-194',
        name: 'HappyHorse Reference to Video',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-195',
        name: 'HappyHorse Text to Video',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-196',
        name: 'HappyHorse Video Edit',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-197',
        name: 'Wan 2.7 Image to Video',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-198',
        name: 'Wan 2.7 Reference to Video',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-199',
        name: 'Wan 2.7 Text to Video',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-200',
        name: 'Wan 2.7 Video Continuation',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-201',
        name: 'Wan 2.7 Video Edit',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-202',
        name: 'Wan Image to Image',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-203',
        name: 'Wan Image to Video',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-204',
        name: 'Wan Reference to Video',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-205',
        name: 'Wan Text to Image',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-206',
        name: 'Wan Text to Video',
        partner: 'Wan',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-207',
        name: 'FlashVSR Video Upscale',
        partner: 'WaveSpeed',
        enabled: true,
        last_modified: null
      },
      {
        id: 'pn-208',
        name: 'WaveSpeed Image Upscale',
        partner: 'WaveSpeed',
        enabled: true,
        last_modified: null
      }
    ]
  }
}

// ---- route table -----------------------------------------------------------
type Route = [string, RegExp, (body?: string) => unknown, (() => number)?]

function renamedWorkspace(body?: string): unknown {
  const active = (
    workspaces() as { workspaces: Array<Record<string, unknown>> }
  ).workspaces[0]
  let name: string | undefined
  try {
    name = body ? (JSON.parse(body) as { name?: string }).name : undefined
  } catch {
    /* ignore */
  }
  return { ...active, name: name ?? active.name }
}

const ROUTES: Route[] = [
  ['GET', /\/api\/workspaces(\?|$)/, workspaces],
  ['PATCH', /\/api\/workspaces\/[^/]+$/, renamedWorkspace],
  ['GET', /\/api\/billing\/status/, billingStatus],
  ['GET', /\/api\/billing\/balance/, balance],
  ['GET', /\/api\/billing\/plans/, plans],
  ['POST', /\/api\/billing\/preview-subscribe/, preview],
  ['POST', /\/api\/billing\/subscribe/, subscribeResp],
  [
    'POST',
    /\/api\/billing\/subscription\/cancel/,
    () => ({ billing_op_id: 'op-1', cancel_at: CANCEL_AT })
  ],
  [
    'POST',
    /\/api\/billing\/subscription\/resubscribe/,
    () => ({ billing_op_id: 'op-1', status: 'active' })
  ],
  [
    'POST',
    /\/api\/billing\/topup/,
    () => ({
      billing_op_id: 'op-1',
      topup_id: 't1',
      status: 'completed',
      amount_cents: 5000
    })
  ],
  [
    'POST',
    /\/api\/billing\/payment-portal/,
    () => ({ url: 'https://example.com/stripe-portal' })
  ],
  ['GET', /\/api\/billing\/ops\//, opStatus],
  ['GET', /\/api\/workspace\/members/, members],
  ['DELETE', /\/api\/workspace\/members\//, () => ({}), () => 204],
  // FE-770 branch only — role change. Toggle 200/500 in the panel.
  [
    'PATCH',
    /\/api\/workspace\/members\//,
    () => (cfg.roleChange === '500' ? { error: 'mock failure' } : {}),
    () => parseInt(cfg.roleChange, 10)
  ],
  ['GET', /\/api\/workspace\/invites/, pendingInvites],
  ['POST', /\/api\/workspace\/invites/, createInvite],
  ['DELETE', /\/api\/workspace\/invites\//, () => ({}), () => 204],
  // Partner node governance (V1)
  ['GET', /\/api\/workspace\/partner-nodes(\?|$)/, partnerNodes],
  ['PUT', /\/api\/workspace\/partner-nodes\/settings/, () => ({})],
  ['PATCH', /\/api\/workspace\/partner-nodes\/[^/]+$/, () => ({})],
  ['PATCH', /\/api\/workspace\/partner-nodes(\?|$)/, () => ({})],
  // PERSONAL legacy
  ['GET', /\/customers\/cloud-subscription-status/, legacyStatus],
  ['GET', /\/customers\/balance/, balance]
]

interface Hit {
  body: unknown
  status: number
}

function lookup(method: string, url: string, body?: string): Hit | null {
  for (const r of ROUTES) {
    if (r[0] === method && r[1].test(url)) {
      return { body: r[2](body), status: r[3] ? r[3]() : 200 }
    }
  }
  return null
}

// `/api/features` (or `/features`): merge the team flag onto the REAL response.
const FEATURES_RE = /\/features(\?|#|$)/

// ---- network patches -------------------------------------------------------
function installXhrPatch(): void {
  const OPEN = XMLHttpRequest.prototype.open
  const SEND = XMLHttpRequest.prototype.send
  type Tagged = XMLHttpRequest & { __mk?: { method: string; url: string } }

  XMLHttpRequest.prototype.open = function (
    this: Tagged,
    method: string,
    url: string | URL
  ) {
    this.__mk = {
      method: String(method || 'GET').toUpperCase(),
      url: String(url)
    }
    // eslint-disable-next-line prefer-rest-params
    return OPEN.apply(this, arguments as unknown as Parameters<typeof OPEN>)
  }

  XMLHttpRequest.prototype.send = function (this: Tagged, ...args) {
    const body = typeof args[0] === 'string' ? args[0] : undefined
    const hit = this.__mk && lookup(this.__mk.method, this.__mk.url, body)
    if (!hit)
      return SEND.apply(this, args as unknown as Parameters<typeof SEND>)
    const xhr = this
    const text = hit.body == null ? '' : JSON.stringify(hit.body)
    const def = (name: string, get: () => unknown) =>
      Object.defineProperty(xhr, name, { configurable: true, get })
    try {
      def('readyState', () => 4)
      def('status', () => hit.status)
      def('responseText', () => text)
      def('response', () => text)
      def('responseURL', () => xhr.__mk?.url ?? '')
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      xhr.onreadystatechange?.(new Event('readystatechange'))
      xhr.dispatchEvent(new Event('readystatechange'))
      xhr.dispatchEvent(
        new Event(hit.status >= 200 && hit.status < 400 ? 'load' : 'error')
      )
      xhr.dispatchEvent(new Event('loadend'))
    }, 15)
  }
}

function installFetchPatch(): void {
  const ORIG = window.fetch.bind(window)
  const urlOf = (input: RequestInfo | URL): string =>
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  const methodOf = (input: RequestInfo | URL, init?: RequestInit): string =>
    String(
      init?.method ||
        (typeof input === 'object' && 'method' in input
          ? input.method
          : 'GET') ||
        'GET'
    ).toUpperCase()

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = urlOf(input)

    // Flag merge: pass the real response through, add only the team flag, and
    // bail to the untouched response on any problem (keeps firebase_config).
    if (FEATURES_RE.test(url)) {
      const real = await ORIG(input, init)
      if (!real.ok) return real
      let json: unknown
      try {
        json = await real.clone().json()
      } catch {
        return real
      }
      if (json && typeof json === 'object') {
        ;(json as Record<string, unknown>).team_workspaces_enabled = true
      }
      return new Response(JSON.stringify(json), {
        status: real.status,
        statusText: real.statusText,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const reqBody = typeof init?.body === 'string' ? init.body : undefined
    const hit = lookup(methodOf(input, init), url, reqBody)
    if (!hit) return ORIG(input, init)
    const text = hit.body == null ? '' : JSON.stringify(hit.body)
    return new Response(text, {
      status: hit.status,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ---- floating control panel ------------------------------------------------
function buildPanel(): void {
  const existing = document.getElementById('cbm-panel')
  if (existing) existing.remove()
  const ui = loadUi()
  const wrap = document.createElement('div')
  wrap.id = 'cbm-panel'
  const pos =
    typeof ui.left === 'number' && typeof ui.top === 'number'
      ? `left:${ui.left}px;top:${ui.top}px`
      : 'top:8px;right:8px'
  wrap.style.cssText = `position:fixed;${pos};z-index:2147483647;background:#15161a;color:#e6e6e6;font:12px/1.4 ui-monospace,monospace;border:1px solid #3a3d46;border-radius:8px;padding:8px 10px;width:232px;box-shadow:0 6px 24px rgba(0,0,0,.5)`

  const row = (label: string, key: keyof MockCfg, opts: string[]) => {
    const id = `cbm-${key}`
    const o = opts
      .map(
        (v) =>
          `<option value="${v}"${cfg[key] === v ? ' selected' : ''}>${v}</option>`
      )
      .join('')
    return `<label style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin:3px 0"><span style="opacity:.7">${label}</span><select id="${id}" data-k="${key}" style="background:#0d0e11;color:#e6e6e6;border:1px solid #3a3d46;border-radius:4px;padding:1px 3px;max-width:120px">${o}</select></label>`
  }

  wrap.innerHTML =
    `<div id="cbm-head" title="drag to move" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;cursor:move;user-select:none"><b style="color:#8ab4ff">Billing Mock</b>` +
    `<span style="display:flex;align-items:center;gap:8px"><span id="cbm-collapse" title="collapse" style="cursor:pointer;opacity:.7;padding:0 4px;border:1px solid #3a3d46;border-radius:4px;line-height:1.4">${ui.collapsed ? '+' : '–'}</span>` +
    `<span id="cbm-close" title="turn off the harness" style="cursor:pointer;opacity:.7;padding:0 4px">✕</span></span></div>` +
    `<div id="cbm-body"${ui.collapsed ? ' style="display:none"' : ''}>` +
    row('workspace', 'ws', OPTIONS.ws) +
    row('role', 'role', OPTIONS.role) +
    row('tier', 'tier', OPTIONS.tier) +
    row('subscription state', 'state', OPTIONS.state) +
    row('credit balance', 'balance', OPTIONS.balance) +
    row('autoReload', 'autoReload', OPTIONS.autoReload) +
    `<hr style="border:0;border-top:1px solid #2a2c33;margin:6px 0"/>` +
    row('roleChange', 'roleChange', OPTIONS.roleChange) +
    `<label style="display:flex;gap:6px;margin:4px 0"><input type="checkbox" id="cbm-multiWs"${cfg.multiWs ? ' checked' : ''}/><span style="opacity:.7">2nd workspace (switcher)</span></label>` +
    `<hr style="border:0;border-top:1px solid #2a2c33;margin:6px 0"/>` +
    `<button id="cbm-queued" style="width:100%;background:#0d0e11;color:#e6e6e6;border:1px solid #3a3d46;border-radius:4px;padding:3px;cursor:pointer">preview: workflow queued</button>` +
    `<div style="font-size:10px;opacity:.55;margin-top:4px">change → saves + reloads · personal=/customers · team=/api/billing</div>` +
    `</div>`
  document.body.appendChild(wrap)

  // A position saved on a larger display can land the panel off-screen, leaving
  // no header to grab. Pull any persisted position back into the viewport.
  if (typeof ui.left === 'number' && typeof ui.top === 'number') {
    const left = Math.min(
      Math.max(0, ui.left),
      Math.max(0, window.innerWidth - wrap.offsetWidth)
    )
    const top = Math.min(
      Math.max(0, ui.top),
      Math.max(0, window.innerHeight - wrap.offsetHeight)
    )
    if (left !== ui.left || top !== ui.top) {
      wrap.style.left = `${left}px`
      wrap.style.top = `${top}px`
      ui.left = left
      ui.top = top
      saveUi(ui)
    }
  }

  // Keep the (non-modal) settings dialog open while using the panel: reka
  // dismisses on a bubble-phase document 'pointerdown'/'focusin' outside its
  // content, so stop those from bubbling out of the panel.
  wrap.addEventListener('pointerdown', (e) => e.stopPropagation())
  wrap.addEventListener('focusin', (e) => e.stopPropagation())

  const apply = () => {
    saveCfg()
    location.reload()
  }
  // Most fields feed data the stores read once at boot, so a reload is the only
  // reliable way to re-derive everything. These don't: autoReload is pure client
  // state (updated live via an event) and roleChange only shapes the next
  // role-change response — so they skip the reload and keep the dialog open.
  const NO_RELOAD = new Set<keyof MockCfg>(['autoReload', 'roleChange'])
  wrap.querySelectorAll('select').forEach((s) => {
    s.addEventListener('change', () => {
      const k = s.getAttribute('data-k') as keyof MockCfg
      ;(cfg as unknown as Record<string, string>)[k] = s.value
      if (NO_RELOAD.has(k)) {
        saveCfg()
        if (k === 'autoReload') {
          window.dispatchEvent(
            new CustomEvent('cbm:autoReload', { detail: s.value })
          )
        }
        return
      }
      apply()
    })
  })
  ;(
    document.getElementById('cbm-multiWs') as HTMLInputElement
  ).addEventListener('change', (e) => {
    cfg.multiWs = (e.target as HTMLInputElement).checked
    apply()
  })

  document.getElementById('cbm-queued')?.addEventListener('click', () => {
    void import('@/services/dialogService').then(({ useDialogService }) =>
      useDialogService().showWorkflowQueuedDialog()
    )
  })

  // turn the harness fully off (back to the real preview)
  const closeBtn = document.getElementById('cbm-close') as HTMLElement
  closeBtn.addEventListener('mousedown', (e) => e.stopPropagation())
  closeBtn.addEventListener('click', () => {
    localStorage.removeItem(ACTIVE_KEY)
    const u = new URL(location.href)
    u.searchParams.delete('billingmock')
    location.replace(u.href)
  })

  // collapse / expand (persisted, no reload)
  const body = document.getElementById('cbm-body') as HTMLElement
  const collapseBtn = document.getElementById('cbm-collapse') as HTMLElement
  collapseBtn.addEventListener('mousedown', (e) => e.stopPropagation())
  collapseBtn.addEventListener('click', () => {
    const u = loadUi()
    u.collapsed = !u.collapsed
    saveUi(u)
    body.style.display = u.collapsed ? 'none' : 'block'
    collapseBtn.textContent = u.collapsed ? '+' : '–'
  })

  // drag the header to reposition (persisted, clamped to viewport, no reload)
  const head = document.getElementById('cbm-head') as HTMLElement
  let dragging = false
  let dx = 0
  let dy = 0
  head.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement
    if (
      target.id === 'cbm-collapse' ||
      target.id === 'cbm-close' ||
      target.tagName === 'INPUT'
    )
      return
    dragging = true
    const r = wrap.getBoundingClientRect()
    dx = e.clientX - r.left
    dy = e.clientY - r.top
    wrap.style.right = 'auto'
    e.preventDefault()
  })
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return
    const left = Math.min(
      Math.max(0, e.clientX - dx),
      window.innerWidth - wrap.offsetWidth
    )
    const top = Math.min(
      Math.max(0, e.clientY - dy),
      window.innerHeight - wrap.offsetHeight
    )
    wrap.style.left = `${left}px`
    wrap.style.top = `${top}px`
  })
  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    const r = wrap.getBoundingClientRect()
    const u = loadUi()
    u.left = Math.round(r.left)
    u.top = Math.round(r.top)
    saveUi(u)
  })
}

function isActivated(): boolean {
  const params = new URLSearchParams(location.search)
  if (params.has('billingmock')) {
    localStorage.setItem(ACTIVE_KEY, '1')
    return true
  }
  return localStorage.getItem(ACTIVE_KEY) === '1'
}

let installed = false

/**
 * Install the billing mock harness. No-op unless opted in via `?billingmock`
 * (or the persisted `cbm.active` flag). MUST be called before the app fetches
 * `/api/features` (i.e. at the very top of `main.ts`) so the flag merge lands.
 */
export function installBillingMockHarness(): void {
  if (installed || !isActivated()) return
  installed = true

  loadCfg()
  // Dev builds honor `ff:` overrides too — harmless belt-and-braces.
  try {
    localStorage.setItem('ff:team_workspaces_enabled', 'true')
    localStorage.setItem('Comfy.Workspace.LastWorkspaceId', 'ws-active')
  } catch {
    /* ignore */
  }

  installXhrPatch()
  installFetchPatch()

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPanel)
  } else {
    buildPanel()
  }
}
