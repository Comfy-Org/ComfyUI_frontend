import type { ReasonKey } from './types.js'

const known: Readonly<Record<string, ReasonKey>> = {
  card_declined: 'declined_generic',
  insufficient_funds: 'declined_insufficient_funds',
  authentication_required: 'declined_authentication_required'
}

export function resolveBillingReason(input: {
  code?: string
  error_message?: string
}): ReasonKey {
  if (input.code && known[input.code]) return known[input.code]
  const message = input.error_message?.toLowerCase() ?? ''
  if (message.includes('insufficient funds'))
    return 'declined_insufficient_funds'
  if (message.includes('authentication required'))
    return 'declined_authentication_required'
  return input.code === 'card_declined' ? 'declined_generic' : 'generic'
}
