/**
 * State registry for the internal Team Billing states viewer (dev-only).
 * Each state maps a sidebar entry to a billingMockHarness config plus the
 * component that renders it. States with no Vue implementation yet render a
 * static mock and are flagged as such in the UI.
 */
export type ViewerRole = 'owner' | 'member-capped' | 'member-uncapped'

export type StateHost =
  | 'menu'
  | 'plancredits'
  | 'members'
  | 'runbutton'
  | 'mock'

interface StateCfg {
  balance?: 'full' | 'partial' | 'low' | 'empty'
  capSpent?: boolean
  state?:
    | 'active'
    | 'cancelled'
    | 'inactive'
    | 'changing'
    | 'at_risk'
    | 'paused'
  autoReload?:
    | 'notset'
    | 'nobudget'
    | 'healthy'
    | 'nearlimit'
    | 'paused'
    | 'off'
}

export interface ViewerState {
  id: string
  title: string
  crumb: string
  roles: ViewerRole[]
  host: StateHost
  group: string
  cfg?: StateCfg
  mock?: string
  spec: string[]
}

export const SITE_TITLE = 'Team Billing — UI States'
export const SITE_SUB =
  'Internal · real components + billingmock data · settled 2026-07-23/24'

export const ROLE_LABELS: Record<ViewerRole, string> = {
  owner: 'Owner',
  'member-capped': 'Member (Capped)',
  'member-uncapped': 'Member (Uncapped)'
}

const MOCK_DECLINE = `
  <div class="mock-dialog">
    <div class="dhead"><b>Payment declined</b><span class="x">✕</span></div>
    <div class="dbody">
      <p class="strong">Your card couldn't be charged. Try another card, or contact your bank if this looks wrong.</p>
      <p class="reason">Stripe reasoning:<br /><span class="strong">Insufficient funds</span></p>
    </div>
    <div class="dfoot"><button class="mbtn wide">Update payment method</button></div>
  </div>`

const MOCK_PAUSED_DIALOG_OWNER = `
  <div class="mock-dialog">
    <div class="dhead"><b>This workspace's subscription is paused</b><span class="x">✕</span></div>
    <div class="dbody">This workspace's subscription is paused. Update payment to resume.</div>
    <div class="dfoot"><button class="mbtn">Update payment</button></div>
  </div>`

const MOCK_PAUSED_DIALOG_MEMBER = `
  <div class="mock-dialog">
    <div class="dhead"><b>This workspace's subscription is paused</b><span class="x">✕</span></div>
    <div class="dbody">Ask your workspace owner to restore the workspace's subscription to run workflows.</div>
    <div class="dfoot"><button class="mbtn">Ok, got it</button></div>
  </div>`

const MOCK_RELOAD_FAILED = `
  <div class="mock-tile">
    <div class="label">Auto-reload <span class="pill">Last reload failed<span class="tip">Card declined on Jun 25</span></span></div>
    <div class="bigrow"><span class="coin">◉</span><span class="big">5,000</span><span class="suffix">when credits drop below <b>1,000</b></span></div>
    <div class="subrow"><span>Monthly budget</span><span class="amber">96% spent</span></div>
    <div class="mbar"><div style="width:96%"></div></div>
    <div class="subrow right">$480 of $500</div>
  </div>`

const HEALTHY = { state: 'active', autoReload: 'healthy' } as const

export const STATES: ViewerState[] = [
  // ---- Profile menu (real component) ----
  {
    id: 'menu-steady',
    title: 'Menu — steady',
    crumb: 'cap 3,000 · used 1,234 · balance healthy',
    roles: ['member-capped'],
    host: 'menu',
    group: 'Profile menu',
    cfg: { ...HEALTHY, balance: 'partial' },
    spec: [
      'Displayed = <span class="mono">min(limit − used, workspaceBalance)</span> — here min(1,766, 36,450).',
      'No denominator, no reset date, no icon, no button in the menu.',
      '<b>Request button floor:</b> appears only when displayed ≤ 1,500.',
      '<span class="mono">Figma 4639-19558 · DES-504</span>'
    ]
  },
  {
    id: 'menu-edge',
    title: 'Menu — edge (hover the ⓘ)',
    crumb: 'remaining 1,766 · balance 1,500 → balance binds',
    roles: ['member-capped'],
    host: 'menu',
    group: 'Profile menu',
    cfg: { ...HEALTHY, balance: 'low' },
    spec: [
      'Trigger: <span class="mono">workspaceBalance &lt; monthlyCreditLimit − creditsUsedThisMonth</span> (strict).',
      'Number stays <b>white</b>; ⓘ + hover popover only — <b>no button</b> (revised 2026-07-24).',
      'Popover floats left of the menu, 12px margin ⇒ 4px visible gap.',
      '<span class="mono">Figma 5217-35986 (canonical)</span>'
    ]
  },
  {
    id: 'menu-limit',
    title: 'Menu — limit reached',
    crumb: 'cap 3,000 · used 3,000 · balance healthy',
    roles: ['member-capped'],
    host: 'menu',
    group: 'Profile menu',
    cfg: { ...HEALTHY, balance: 'partial', capSpent: true },
    spec: [
      'Amber is reserved for this state (limit binding at zero).',
      'Click → email to workspace owner (no notification center); sent-state protects the inbox.',
      '<span class="mono">Precedence: workspace-out beats limit-reached</span>'
    ]
  },
  {
    id: 'menu-wsout',
    title: 'Menu — workspace out of credits',
    crumb: 'balance 0 · beats limit-reached',
    roles: ['member-capped', 'member-uncapped'],
    host: 'menu',
    group: 'Profile menu',
    cfg: { ...HEALTHY, balance: 'empty' },
    spec: [
      "Workspace-empty wins over limit-reached — raising a cap wouldn't help when the pool is dry.",
      'Same state for capped and uncapped members; button routes to "Notify workspace owner".',
      '<span class="mono">Run-lock: out-of-credits dialog on Run click (shipped, cfaf89ede)</span>'
    ]
  },
  {
    id: 'menu-uncapped-steady',
    title: 'Menu — healthy balance',
    crumb: 'no cap · balance 36,450 · no button',
    roles: ['member-uncapped'],
    host: 'menu',
    group: 'Profile menu',
    cfg: { ...HEALTHY, balance: 'partial' },
    spec: [
      'Uncapped members see the plain workspace balance — pool numbers never wear bars or denominators.',
      'No button above the 1,500 floor.'
    ]
  },
  {
    id: 'menu-uncapped-low',
    title: 'Menu — low balance',
    crumb: 'no cap · balance 1,500 → request button',
    roles: ['member-uncapped'],
    host: 'menu',
    group: 'Profile menu',
    cfg: { ...HEALTHY, balance: 'low' },
    spec: [
      'Button label follows the binding cause: pool → "Request more credits".',
      '<span class="mono">≤ 1,500 floor · placeholder pending balance-at-top-up instrumentation</span>'
    ]
  },
  {
    id: 'menu-owner',
    title: 'Menu — owner view',
    crumb: 'owner · workspace balance + Add credits',
    roles: ['owner'],
    host: 'menu',
    group: 'Profile menu',
    cfg: { ...HEALTHY, balance: 'partial' },
    spec: [
      'Owners are never capped (incl. their own row) — they see the raw workspace balance.',
      'Add credits is billing-manager-only; members never get a top-up affordance here.'
    ]
  },

  // ---- Plan & Credits, full tab (real component) ----
  {
    id: 'pc-owner',
    title: 'Plan & Credits — full tab',
    crumb: 'owner · overview + auto-reload configured',
    roles: ['owner'],
    host: 'plancredits',
    group: 'Plan & Credits',
    cfg: { ...HEALTHY, balance: 'partial' },
    spec: [
      'Full tab: billing banner slot, Overview / Activity / Invoices strip, plan header, credits tile, auto-reload.',
      'Auto-reload section is billing-manager-only (<span class="mono">canManageBilling</span>) — members never see it.',
      'Activity and Invoices tabs are live: click through to check the whole surface.'
    ]
  },
  {
    id: 'pc-owner-nearlimit',
    title: 'Auto-reload — near budget limit',
    crumb: 'owner · reload on, monthly budget nearly spent',
    roles: ['owner'],
    host: 'plancredits',
    group: 'Plan & Credits',
    cfg: { state: 'active', autoReload: 'nearlimit', balance: 'partial' },
    spec: [
      'Amber budget meter is the proactive warning; the reload itself is still armed.',
      'When the budget is fully spent the reload pauses — no charge is attempted, so no failure to report.',
      'Budget-paused therefore suppresses the failed-reload pill.'
    ]
  },
  {
    id: 'pc-member',
    title: 'Plan & Credits — member view',
    crumb: 'member · member tile, no auto-reload',
    roles: ['member-capped', 'member-uncapped'],
    host: 'plancredits',
    group: 'Plan & Credits',
    cfg: { ...HEALTHY, balance: 'partial' },
    spec: [
      'Member tile replaces the workspace credits tile — same number as the menu (<span class="mono">useMemberCreditDisplay</span>).',
      'No Additional credits row, no workspace inventory, no auto-reload section — hidden for members by design.',
      'Plan header (name · credits/mo · renewal) stays member-visible: metadata, not runway.'
    ]
  },
  {
    id: 'pc-member-edge',
    title: 'Plan & Credits — member edge',
    crumb: 'remaining 1,766 · balance 1,500',
    roles: ['member-capped'],
    host: 'plancredits',
    group: 'Plan & Credits',
    cfg: { ...HEALTHY, balance: 'low' },
    spec: [
      'Bar hides — a limit-denominated bar would contradict the substituted number.',
      'Inline explainer mirrors the menu popover copy exactly.',
      '<span class="mono">Figma 5217-35986</span>'
    ]
  },
  {
    id: 'pc-member-limit',
    title: 'Plan & Credits — member limit reached',
    crumb: 'cap 3,000 · used 3,000',
    roles: ['member-capped'],
    host: 'plancredits',
    group: 'Plan & Credits',
    cfg: { ...HEALTHY, balance: 'partial', capSpent: true },
    spec: [
      'Amber zero; reset date in the tile label answers "when do I get more?".',
      "The plan header's renewal date is the wrong date for a capped member — the tile label carries the right one."
    ]
  },

  // ---- Members table (real component) ----
  {
    id: 'table-caps',
    title: 'Members table — caps',
    crumb: 'owner view · caps are Member-only',
    roles: ['owner'],
    host: 'members',
    group: 'Members',
    cfg: { ...HEALTHY, balance: 'partial' },
    spec: [
      '<b>Set credit limit appears on Member rows only</b> — never owner rows, never your own row (#13716 needs this amend before merge).',
      'Bar is a pure policy meter (used / limit), clamped at 100% for over-limit rows.',
      'Unlimited rows show usage only. Pool shortage is carried by tile/banners, not per-row.'
    ]
  },

  // ---- Payment failed — banners real, dialogs mocked ----
  {
    id: 'pay-atrisk',
    title: 'Payment declined — banner',
    crumb: 'owner · retry window open, subscription still active',
    roles: ['owner'],
    host: 'plancredits',
    group: 'Payment failed',
    cfg: { state: 'at_risk', autoReload: 'healthy', balance: 'partial' },
    spec: [
      'Banner is the global alarm; it names the pause date so the retry window is legible.',
      'CTA routes to the Stripe billing portal (<span class="mono">accessBillingPortal()</span>) — same destination as the decline dialog.',
      '<span class="mono">DES-380 · banner entity doc</span>'
    ]
  },
  {
    id: 'pay-paused-banner',
    title: 'Paused — banner (owner)',
    crumb: 'owner · retry window expired, subscription paused',
    roles: ['owner'],
    host: 'plancredits',
    group: 'Payment failed',
    cfg: { state: 'paused', autoReload: 'healthy', balance: 'partial' },
    spec: [
      'Owner copy names the fix: update payment to resume.',
      "Recovery grants the period's plan credits <b>immediately</b>; the billing anchor never shifts (settled 2026-07-24).",
      '<span class="mono">Figma 5242-31803</span>'
    ]
  },
  {
    id: 'pay-paused-banner-member',
    title: 'Paused — banner (member)',
    crumb: 'member · same state, different copy',
    roles: ['member-capped', 'member-uncapped'],
    host: 'plancredits',
    group: 'Payment failed',
    cfg: { state: 'paused', autoReload: 'healthy', balance: 'partial' },
    spec: [
      'Member copy never mentions payment details — those are billing-manager-only.',
      '<b>Copy delta to settle:</b> the shipped banner says "Your workspace admins need to update the payment method"; the run-lock dialog we settled says "Ask your workspace owner to restore the workspace\'s subscription". Owner vs admin, payment vs subscription.',
      '<span class="mono">workspacePanel.billingStatus.paused.memberBody</span>'
    ]
  },
  {
    id: 'pay-decline',
    title: 'Payment decline dialog (mock)',
    crumb: 'a charge the user just attempted (top-up / subscribe)',
    roles: ['owner'],
    host: 'mock',
    group: 'Payment failed',
    mock: MOCK_DECLINE,
    spec: [
      'Update payment method → <span class="mono">accessBillingPortal()</span> in a new tab; dialog closes; intent preserved.',
      '<b>No auto-success</b> — refetch-on-refocus converges the banner.',
      '<span class="mono">Figma 4198-20207 · DES-380</span>'
    ]
  },
  {
    id: 'pay-paused-owner',
    title: 'Paused run-lock — owner',
    crumb: 'real locked Run button + designed dialog (mock)',
    roles: ['owner'],
    host: 'runbutton',
    group: 'Payment failed',
    cfg: { state: 'paused', autoReload: 'healthy', balance: 'partial' },
    mock: MOCK_PAUSED_DIALOG_OWNER,
    spec: [
      'The button is the <b>real</b> shipped component (<span class="mono">SubscribeToRun.vue</span>) under a paused subscription.',
      '<b>Gap:</b> it still renders the inactive-state label. Paused needs its own label ("Update payment to run") and dialog — the component forks on <span class="mono">canManageSubscription</span> only, never on cause.',
      'Dialog below is the designed target, not yet built.',
      '<span class="mono">Figma 5242-31803</span>'
    ]
  },
  {
    id: 'pay-paused-member',
    title: 'Paused run-lock — member',
    crumb: 'real locked Run button + designed dialog (mock)',
    roles: ['member-capped', 'member-uncapped'],
    host: 'runbutton',
    group: 'Payment failed',
    cfg: { state: 'paused', autoReload: 'healthy', balance: 'partial' },
    mock: MOCK_PAUSED_DIALOG_MEMBER,
    spec: [
      'Member buttons never fork across causes — locked "Run"; the cause lives in dialog copy.',
      'The shipped button already renders exactly this for members, because member copy is cause-agnostic by design.',
      'Only the dialog needs building: reuse the inactive shell + <span class="mono">subscription.paused.*</span> keys.',
      '<span class="mono">Family: inactive (shipped) · paused (designed) · out-of-credits (member shipped, owner parked)</span>'
    ]
  },
  {
    id: 'pay-inactive-runlock',
    title: 'Inactive run-lock (shipped)',
    crumb: 'reference: the shipped run-lock this family extends',
    roles: ['owner', 'member-capped'],
    host: 'runbutton',
    group: 'Payment failed',
    cfg: { state: 'inactive', autoReload: 'healthy', balance: 'partial' },
    spec: [
      'Shipped in #12786 — the grammar the paused variant should follow.',
      'Owner label names the fix ("Subscribe to Run"); member label stays a plain locked "Run".',
      'Switch the role dropdown to see both halves of the fork.'
    ]
  },

  // ---- Auto-reload failure (design only) ----
  {
    id: 'reload-failed',
    title: 'Failed reload — pill (mock)',
    crumb: 'a reload charge bounced · budget not paused',
    roles: ['owner'],
    host: 'mock',
    group: 'Auto-reload',
    mock: MOCK_RELOAD_FAILED,
    spec: [
      'Amber pill in the label row — single alarm color; red stays reserved for destructive actions.',
      'Tooltip = Stripe reason + date. Banner (payment_failed) is the global alarm; the pill is the local diagnosis.',
      'No harness fixture drives this yet — there is no <span class="mono">failed</span> auto-reload state to select.',
      '<span class="mono">Figma 5254-33590 · BE confirm: failed reload emits payment_failed (BE-3324)</span>'
    ]
  }
]

const HARNESS_LS = 'comfyBillingMock'

export function parseHash(): { role: ViewerRole; stateId: string } {
  const [role, stateId] = location.hash.slice(1).split('/')
  const validRole = (
    ['owner', 'member-capped', 'member-uncapped'] as ViewerRole[]
  ).includes(role as ViewerRole)
    ? (role as ViewerRole)
    : 'member-capped'
  const candidates = STATES.filter((s) => s.roles.includes(validRole))
  const state = candidates.find((s) => s.id === stateId) ?? candidates[0]
  return { role: validRole, stateId: state.id }
}

function wantedCfg(role: ViewerRole, state: ViewerState) {
  return {
    role: role === 'owner' ? 'owner' : 'member',
    selfCap: role === 'member-capped' ? 'capped' : 'uncapped',
    capSpent: state.cfg?.capSpent ?? false,
    balance: state.cfg?.balance ?? 'partial',
    state: state.cfg?.state ?? 'active',
    autoReload: state.cfg?.autoReload ?? 'healthy'
  }
}

/** Write the harness cfg for a state, set the hash, and reload (the harness
 *  reads cfg once per page load, mirroring its own panel behavior). */
export function activateState(role: ViewerRole, stateId: string): void {
  const state = STATES.find((s) => s.id === stateId)
  if (!state) return
  const saved = JSON.parse(localStorage.getItem(HARNESS_LS) || '{}') as Record<
    string,
    unknown
  >
  const wanted = wantedCfg(role, state)
  localStorage.setItem(
    HARNESS_LS,
    JSON.stringify({ ...saved, ws: 'team', tier: 'creator', ...wanted })
  )
  localStorage.setItem('cbm.autoReload', wanted.autoReload)
  location.hash = `${role}/${stateId}`
  location.reload()
}

/** Ensure the persisted harness cfg matches the hash-selected state. Returns
 *  true when a reload was triggered (caller should skip mounting). */
export function syncCfgToHash(): boolean {
  const { role, stateId } = parseHash()
  const state = STATES.find((s) => s.id === stateId)
  if (!state) return false
  const saved = JSON.parse(localStorage.getItem(HARNESS_LS) || '{}') as Record<
    string,
    unknown
  >
  const wanted = wantedCfg(role, state)
  if (Object.entries(wanted).every(([k, v]) => saved[k] === v)) return false
  activateState(role, stateId)
  return true
}
