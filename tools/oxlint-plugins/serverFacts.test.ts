import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'

import { noCapabilityRecombination, noServerFactLiterals } from './serverFacts'

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
})

ruleTester.run('no-capability-recombination', noCapabilityRecombination, {
  valid: [
    {
      name: 'a capability rendered alone',
      code: `
const { canTopUp } = useBillingCapabilities()
const showTopUp = computed(() => canTopUp.value)
`
    },
    {
      name: 'a capability defaulted with a literal',
      code: `const canCancel = computed(() => capabilities.value?.can_cancel ?? false)`
    },
    {
      name: 'a recombination wrapped in pendingServerFact',
      code: `
const { canInviteMembers } = useBillingCapabilities()
const canInvite = computed(() =>
  pendingServerFact('BE-1', canInviteMembers.value || isPlanEnded.value)
)
`
    },
    {
      name: 'a pendingServerFact result combined later',
      code: `
const { canInviteMembers } = useBillingCapabilities()
const canInvite = pendingServerFact('BE-1', canInviteMembers.value && isOwner)
const showInvite = canInvite || isLoading.value
`
    },
    {
      name: 'a can-prefixed local that is not a capability',
      code: `
const canClose = computed(() => open.value && dirty.value)
const ready = canClose.value || isLoading.value
`
    },
    {
      name: 'client-only flags combined with each other',
      code: `
const a = isCloud && isNightly
const b = isLoading.value || isReady.value
`
    },
    {
      name: 'a capability narrowed by a negated loading flag',
      code: `
const { canInviteMembers } = useBillingCapabilities()
const enabled = canInviteMembers.value && !isLoading.value
`
    },
    {
      name: 'a disabled state from a negated capability or an in-flight submit',
      code: `
const { canTopUp } = useBillingCapabilities()
const disabled = !canTopUp.value || isSubmitting.value
`
    },
    {
      name: 'a capability narrowed by several local flags',
      code: `
const { canTopUp } = useBillingCapabilities()
const enabled = isValid.value && canTopUp.value && !inFlight
const disabled = !(canTopUp.value && !saving.value) || isDirty.value
const locked = isSaving.value || !isValid.value || !canTopUp.value
`
    },
    {
      name: 'a property that merely shares a capability name',
      code: `
const { canTopUp } = useBillingCapabilities()
const enabled = options.canTopUp || fallback
`
    },
    {
      name: 'a capability defaulted while loading',
      code: `
const { canTopUp } = useBillingCapabilities()
const enabled = isLoading.value ? false : canTopUp.value
`
    },
    {
      name: 'a capability defaulted by negated or positive local state',
      code: `
const { canTopUp } = useBillingCapabilities()
const a = !isSubmitting.value ? canTopUp.value : false
const b = isValid.value ? canTopUp.value : undefined
const c = isLoading.value ? null : canTopUp.value && !isSaving.value
`
    },
    {
      name: 'a disabled state forced while submitting',
      code: `
const { canTopUp } = useBillingCapabilities()
const disabled = isSubmitting.value ? true : !canTopUp.value
`
    },
    {
      name: 'a capability narrowed by an in-flight operation, form or read state',
      code: `
const { canTopUp } = useBillingCapabilities()
const a = topupOperation.value && canTopUp.value
const b = !operation || !canTopUp.value
const c = paymentLocked.value || !isValidAmount.value || !canTopUp.value
const d = canTopUp.value && hasResolvedCapabilities.value && isReady.value
const e = snapshotAuthoritative.value ? canTopUp.value : false
const f = canTopUp.value && !isHiddenOnSection.value
`
    },
    {
      name: 'a step, layout or presentation seeded once from a capability',
      code: `
const { canTopUp } = useBillingCapabilities()
const step = ref(canTopUp.value ? 'verifying' : 'amount')
const uiConfig = computed(() => ({ showSearch: canTopUp.value, cols: 'grid' }))
const presentation = computed(() => {
  if (!ready.value) return DEFAULT_PRESENTATION
  return resolvePresentation({ canTopUp: canTopUp.value })
})
const view = () => (canTopUp.value ? { muted: false } : { muted: true })
const a = step.value === 'verifying' && hasSeats.value
const b = uiConfig.value.showSearch && hasSeats.value
const c = isTeam.value ? toReason(presentation.value) : 'unknown'
const d = isTeam.value ? view() : null
`
    },
    {
      name: 'a capability defaulted while its source is absent',
      code: `
const a = capabilities.value ? capabilities.value.can_top_up : false
const b = !capabilities.value ? false : capabilities.value.can_top_up
const c = capabilities.value?.can_top_up ?? false
`
    }
  ],
  invalid: [
    {
      name: '#15675 capability chosen by isCloud with a role fallback',
      code: `
const { canChangeSeats } = useBillingCapabilities()
const canManage = computed(() =>
  isCloud ? canChangeSeats.value : workspaceRole.value === 'owner'
)
`,
      errors: [{ messageId: 'chosen' }]
    },
    {
      name: '#18662 capability or-ed with plan state and a permission',
      code: `
const { canInviteMembers } = useBillingCapabilities()
const canInvite = computed(
  () =>
    canInviteMembers.value ||
    (isPlanEnded.value && permissions.value.canManageSubscription)
)
`,
      errors: [{ messageId: 'combined', data: { operator: '||' } }]
    },
    {
      name: '#16967 capability object member chosen by isCloud',
      code: `
const capabilities = useBillingCapabilities()
const canChangeSeats = computed(() =>
  isCloud
    ? capabilities.canChangeSeats.value
    : permissions.value.canManageSubscription
)
`,
      errors: [{ messageId: 'chosen' }]
    },
    {
      name: '#16967 proxy choice between two capabilities by plan tier',
      code: `
const { canChangeSeats, canSubscribeSelfServe } = useBillingCapabilities()
function canAct(tier) {
  return hasActivePaidPlan(tier)
    ? canChangeSeats.value
    : canSubscribeSelfServe.value
}
`,
      errors: [{ messageId: 'chosen' }]
    },
    {
      name: 'a raw capability field defaulted to a role check',
      code: `const canTopUp = capabilities.value?.can_top_up ?? workspaceStore.activeWorkspace?.role === 'owner'`,
      errors: [{ messageId: 'combined', data: { operator: '??' } }]
    },
    {
      name: 'two capabilities or-ed together',
      code: `
const { canTopUp, canSubscribeSelfServe } = useBillingCapabilities()
const showBuy = canTopUp.value || canSubscribeSelfServe.value
`,
      errors: [{ messageId: 'combined', data: { operator: '||' } }]
    },
    {
      name: 'a capability narrowed by a server-derived seat fact',
      code: `
const { canInviteMembers } = useBillingCapabilities()
const enabled = canInviteMembers.value && hasMemberSeats.value
`,
      errors: [{ messageId: 'combined', data: { operator: '&&' } }]
    },
    {
      name: 'a loading flag that grants a capability through ||',
      code: `
const { canTopUp } = useBillingCapabilities()
const enabled = canTopUp.value || isLoading.value
`,
      errors: [{ messageId: 'combined', data: { operator: '||' } }]
    },
    {
      name: 'a local flag that grants when the capability is false',
      code: `
const { canTopUp } = useBillingCapabilities()
const enabled = !canTopUp.value && isOpen.value
`,
      errors: [{ messageId: 'combined', data: { operator: '&&' } }]
    },
    {
      name: 'a narrowed capability or-ed with a local flag',
      code: `
const { canTopUp } = useBillingCapabilities()
const enabled = (canTopUp.value && !isLoading.value) || isSaving.value
`,
      errors: [{ messageId: 'combined', data: { operator: '||' } }]
    },
    {
      name: 'in-flight or read state that grants a capability',
      code: `
const { canTopUp } = useBillingCapabilities()
const a = canTopUp.value || topupOperation.value
const b = !canTopUp.value && hasResolvedCapabilities.value
const c = paymentLocked.value ? true : canTopUp.value
`,
      errors: [
        { messageId: 'combined', data: { operator: '||' } },
        { messageId: 'combined', data: { operator: '&&' } },
        { messageId: 'chosen' }
      ]
    },
    {
      name: 'server-derived plan and subscription flags next to a capability',
      code: `
const { canTopUp } = useBillingCapabilities()
const a = canTopUp.value && !isPlanEnded.value
const b = canTopUp.value && isTeamPlan.value
const c = !canTopUp.value || !isSubscribed.value
`,
      errors: [
        { messageId: 'combined', data: { operator: '&&' } },
        { messageId: 'combined', data: { operator: '&&' } },
        { messageId: 'combined', data: { operator: '||' } }
      ]
    },
    {
      name: 'an alias of a capability combined later',
      code: `
const { canTopUp } = useBillingCapabilities()
const topUpAllowed = computed(() => canTopUp.value)
const showTopUp = topUpAllowed.value && isPersonal.value
`,
      errors: [{ messageId: 'combined', data: { operator: '&&' } }]
    },
    {
      name: 'a boolean gate returned from a block-bodied computed, combined later',
      code: `
const { canTopUp } = useBillingCapabilities()
const permitted = computed(() => {
  if (!snapshotAuthoritative.value) return true
  return canTopUp.value
})
const show = permitted.value && hasSeats.value
`,
      errors: [{ messageId: 'combined', data: { operator: '&&' } }]
    },
    {
      name: 'a can-prefixed field of a permissions object built from a capability',
      code: `
const { canInviteMembers } = useBillingCapabilities()
const permissions = computed(() => ({
  ...base.value,
  canInvite: canInviteMembers.value
}))
const show = permissions.value.canInvite && hasSeats.value
`,
      errors: [{ messageId: 'combined', data: { operator: '&&' } }]
    },
    {
      name: 'a capability defaulted by server-derived plan state',
      code: `
const { canInviteMembers } = useBillingCapabilities()
const enabled = isPlanEnded.value ? false : canInviteMembers.value
`,
      errors: [{ messageId: 'chosen' }]
    },
    {
      name: 'a local flag that grants through a ternary',
      code: `
const { canTopUp } = useBillingCapabilities()
const a = isLoading.value ? true : canTopUp.value
const b = isSubmitting.value ? false : !canTopUp.value
`,
      errors: [{ messageId: 'chosen' }, { messageId: 'chosen' }]
    },
    {
      name: 'a capability chosen by another capability',
      code: `
const { canTopUp, canSubscribeSelfServe } = useBillingCapabilities()
const a = canTopUp.value ? canSubscribeSelfServe.value : false
const b = capabilities.value.can_a ? capabilities.value.can_b : false
`,
      errors: [{ messageId: 'chosen' }, { messageId: 'chosen' }]
    },
    {
      name: 'a presence check of a different object or inverted polarity',
      code: `
const a = other.value ? capabilities.value.can_top_up : false
const b = capabilities.value ? false : capabilities.value.can_top_up
`,
      errors: [{ messageId: 'chosen' }, { messageId: 'chosen' }]
    }
  ]
})

ruleTester.run('no-server-fact-literals', noServerFactLiterals, {
  valid: [
    {
      name: 'local result, chat and channel literals',
      code: `
const ok = result.status === 'ok'
const fromUser = msg.role === 'user'
const other = ch.role !== 'selection'
`
    },
    {
      name: 'a role comparison wrapped in pendingServerFact',
      code: `const isOwner = pendingServerFact('BE-1', role.value === 'owner')`
    },
    {
      name: 'a lowercase client catalog tier key',
      code: `
const isTeam = context.tier === 'team'
const isFixed = tier === 'free' || tier === 'founder'
`
    },
    {
      name: 'includes on a list of messages',
      code: `const seen = messageIds.includes(id)`
    }
  ],
  invalid: [
    {
      name: 'a session role compared with a role value',
      code: `const isPaid = session.value?.role !== 'member'`,
      errors: [
        { messageId: 'compared', data: { field: 'role', literal: 'member' } }
      ]
    },
    {
      name: 'a role literal on the left side',
      code: `const isOwner = 'owner' === workspace.role`,
      errors: [
        { messageId: 'compared', data: { field: 'role', literal: 'owner' } }
      ]
    },
    {
      name: 'a subscription tier compared with a literal',
      code: `const isEnterprise = subscription.value?.tier === 'ENTERPRISE'`,
      errors: [
        {
          messageId: 'compared',
          data: { field: 'tier', literal: 'ENTERPRISE' }
        }
      ]
    },
    {
      name: 'every server tier compared with a literal',
      code: `
const a = tier === 'FREE'
const b = tier === 'STANDARD'
const c = tier === 'CREATOR'
const d = tier === 'PRO'
const e = tier === 'FOUNDERS_EDITION'
const f = tier === 'TEAM'
`,
      errors: [
        { messageId: 'compared', data: { field: 'tier', literal: 'FREE' } },
        { messageId: 'compared', data: { field: 'tier', literal: 'STANDARD' } },
        { messageId: 'compared', data: { field: 'tier', literal: 'CREATOR' } },
        { messageId: 'compared', data: { field: 'tier', literal: 'PRO' } },
        {
          messageId: 'compared',
          data: { field: 'tier', literal: 'FOUNDERS_EDITION' }
        },
        { messageId: 'compared', data: { field: 'tier', literal: 'TEAM' } }
      ]
    },
    {
      name: 'a subscription status compared with a literal',
      code: `const ended = subscriptionStatus.value === 'ended'`,
      errors: [
        {
          messageId: 'compared',
          data: { field: 'subscriptionStatus', literal: 'ended' }
        }
      ]
    },
    {
      name: 'a missing role defaulted to owner',
      code: `const effectiveRole = role ?? 'owner'`,
      errors: [{ messageId: 'roleFallback', data: { literal: 'owner' } }]
    },
    {
      name: 'a server error message matched as text',
      code: `const oom = error.message.includes('CUDA')`,
      errors: [{ messageId: 'messageMatch' }]
    }
  ]
})
