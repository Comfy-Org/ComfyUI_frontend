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
const LS = 'comfyBillingMock'
const LS_UI = 'cbm_ui'
const ACTIVE_KEY = 'cbm.active'

type Workspace = 'personal' | 'team'
type Role = 'owner' | 'member'
type Tier = 'free' | 'standard' | 'creator' | 'pro'
type State = 'active' | 'cancelled' | 'inactive' | 'changing'
type Balance = 'funded' | 'low' | 'empty'

interface MockCfg {
  ws: Workspace
  role: Role
  tier: Tier
  state: State
  balance: Balance
  roleChange: '200' | '500'
  multiWs: boolean
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
  balance: 'funded',
  roleChange: '200',
  multiWs: false
}

const cfg: MockCfg = { ...DEFAULTS }

function loadCfg(): void {
  try {
    Object.assign(cfg, JSON.parse(localStorage.getItem(LS) || '{}'))
  } catch {
    /* ignore */
  }
}
function saveCfg(): void {
  localStorage.setItem(LS, JSON.stringify(cfg))
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
  pro: 'PRO'
}
// [price_cents, credits] per personal tier (monthly)
const PRICING: Record<Tier, [number, number]> = {
  free: [0, 0],
  standard: [2000, 4200],
  creator: [3500, 7400],
  pro: [10000, 21100]
}
const BALANCES: Record<Balance, [number, number, number]> = {
  // [amount_micros, cloud_credit (monthly), prepaid (additional)]
  funded: [5000000, 2000000, 3000000],
  low: [1000000, 0, 1000000],
  empty: [0, 0, 0]
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
          role: cfg.role,
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
    changing: 'scheduled'
  })[cfg.state]

// TEAM — /api/billing/status (has_funds, cancel_at)
function billingStatus(): unknown {
  return {
    is_active: cfg.state !== 'inactive',
    has_funds: cfg.balance !== 'empty',
    subscription_status: subStatus(),
    subscription_tier: TIER[cfg.tier],
    subscription_duration: 'MONTHLY',
    plan_slug: slug(cfg.tier),
    billing_status: cfg.state === 'inactive' ? 'inactive' : 'paid',
    renewal_date: FUTURE,
    cancel_at: cfg.state === 'cancelled' ? CANCEL_AT : undefined
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
  const b = BALANCES[cfg.balance] || BALANCES.funded
  return {
    amount_micros: b[0],
    currency: 'usd',
    effective_balance_micros: b[0],
    cloud_credit_balance_micros: b[1],
    prepaid_balance_micros: b[2]
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
  const creator = {
    id: 'user-creator',
    name: 'You (creator)',
    email: 'you@comfy.org',
    joined_at: '2026-01-01T00:00:00Z',
    role: 'owner',
    is_original_owner: true
  }
  const m1 = {
    id: 'user-42',
    name: 'Alice',
    email: 'alice@example.com',
    joined_at: '2026-02-15T00:00:00Z',
    role: 'member',
    is_original_owner: false
  }
  const m2 = {
    id: 'user-43',
    name: 'Bob',
    email: 'bob@example.com',
    joined_at: '2026-03-20T00:00:00Z',
    role: 'owner',
    is_original_owner: false
  }
  const list = cfg.ws === 'team' ? [creator, m1, m2] : [creator]
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

// Partner node governance (V1). Canned list; toggles are optimistic client-side
// so they hold within a session but reset on reload.
function partnerNodes(): unknown {
  const node = (
    id: string,
    name: string,
    partner: string,
    enabled: boolean,
    last_modified: string | null
  ) => ({ id, name, partner, enabled, last_modified })
  return {
    auto_enable_new: true,
    partner_nodes: [
      node('pn-1', 'Anthropic Claude', 'Anthropic', true, '2026-07-31'),
      node('pn-2', 'Flux 1.1 [pro] Ultra Image', 'BFL', true, null),
      node('pn-3', 'Flux.1 Kontext [pro] Image', 'BFL', true, null),
      node('pn-4', 'Flux.1 Kontext [max] Image', 'BFL', false, '2026-08-01'),
      node('pn-5', 'Flux.1 Expand Image', 'BFL', true, null),
      node('pn-6', 'Flux.1 Fill Image', 'BFL', false, '2026-08-08'),
      node('pn-7', 'Flux Erase Image', 'BFL', true, null),
      node('pn-8', 'Kling Start-End Frame to Video', 'Kling', true, null),
      node('pn-9', 'Kling Image to Video', 'Kling', true, null),
      node('pn-10', 'Veo 3 Text to Video', 'Google', true, null),
      node('pn-11', 'Ideogram V3', 'Ideogram', true, null),
      node('pn-12', 'Grok Image', 'Grok', false, '2026-07-20')
    ]
  }
}

// ---- route table -----------------------------------------------------------
type Route = [string, RegExp, () => unknown, (() => number)?]

const ROUTES: Route[] = [
  ['GET', /\/api\/workspaces(\?|$)/, workspaces],
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
  ['GET', /\/api\/workspace\/invites/, () => ({ invites: [] })],
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

function lookup(method: string, url: string): Hit | null {
  for (const r of ROUTES) {
    if (r[0] === method && r[1].test(url)) {
      return { body: r[2](), status: r[3] ? r[3]() : 200 }
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
    const hit = this.__mk && lookup(this.__mk.method, this.__mk.url)
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

    const hit = lookup(methodOf(input, init), url)
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
    row('workspace', 'ws', ['personal', 'team']) +
    row('role', 'role', ['owner', 'member']) +
    row('tier', 'tier', ['free', 'standard', 'creator', 'pro']) +
    row('state', 'state', ['active', 'cancelled', 'inactive', 'changing']) +
    row('balance', 'balance', ['funded', 'low', 'empty']) +
    `<hr style="border:0;border-top:1px solid #2a2c33;margin:6px 0"/>` +
    row('roleChange', 'roleChange', ['200', '500']) +
    `<label style="display:flex;gap:6px;margin:4px 0"><input type="checkbox" id="cbm-multiWs"${cfg.multiWs ? ' checked' : ''}/><span style="opacity:.7">2nd workspace (switcher)</span></label>` +
    `<div style="font-size:10px;opacity:.55;margin-top:4px">change → saves + reloads · personal=/customers · team=/api/billing</div>` +
    `</div>`
  document.body.appendChild(wrap)

  const apply = () => {
    saveCfg()
    location.reload()
  }
  wrap.querySelectorAll('select').forEach((s) => {
    s.addEventListener('change', () => {
      const k = s.getAttribute('data-k') as keyof MockCfg
      ;(cfg as unknown as Record<string, string>)[k] = s.value
      apply()
    })
  })
  ;(
    document.getElementById('cbm-multiWs') as HTMLInputElement
  ).addEventListener('change', (e) => {
    cfg.multiWs = (e.target as HTMLInputElement).checked
    apply()
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
