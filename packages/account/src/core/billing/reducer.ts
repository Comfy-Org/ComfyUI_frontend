import { resolveBillingReason } from './reasons.js'
import type { BillingOperationStatus, BillingState } from './types.js'

export type BillingEvent =
  | { type: 'started'; operationId: string }
  | { type: 'urlReceived'; url: string }
  | { type: 'actionFailed'; message: string }
  | {
      type: 'opStatus'
      status: BillingOperationStatus
      reason_code?: string
      error_message?: string
      no_charge_confirmed?: boolean
    }
  | {
      type: 'hostReturned'
      result: 'success' | 'failed'
      backendCanceled?: boolean
    }
  | { type: 'reset' }

export const initialBillingState: BillingState = {
  step: 'select',
  noChargeConfirmed: false
}

export function reduceBilling(
  state: BillingState,
  event: BillingEvent
): BillingState {
  if (event.type === 'reset') return initialBillingState
  if (event.type === 'started')
    return {
      operationId: event.operationId,
      step: 'preview',
      noChargeConfirmed: false
    }
  if (event.type === 'urlReceived')
    return { ...state, step: 'verifying', actionUrl: event.url }
  if (event.type === 'actionFailed')
    return { ...state, step: 'verifying', actionError: event.message }
  if (event.type === 'hostReturned') {
    if (event.result === 'success') return { ...state, step: 'verifying' }
    return {
      ...state,
      step: event.backendCanceled ? 'canceled' : 'processing_error',
      noChargeConfirmed: event.backendCanceled === true
    }
  }
  if (event.status === 'pending')
    return { ...state, step: state.actionUrl ? 'verifying' : 'preview' }
  if (event.status === 'succeeded')
    return { ...state, step: 'success', actionUrl: undefined }
  if (event.status === 'canceled')
    return {
      ...state,
      step: 'canceled',
      actionUrl: undefined,
      noChargeConfirmed: event.no_charge_confirmed === true
    }
  if (event.status === 'payment_received_hold')
    return { ...state, step: 'payment_received_hold', actionUrl: undefined }
  if (event.status === 'expired')
    return {
      ...state,
      step: 'preview',
      reasonKey: 'checkout_expired',
      actionUrl: undefined
    }
  if (event.status === 'timeout')
    return {
      ...state,
      step: 'processing_error',
      reasonKey: 'generic',
      actionUrl: undefined
    }
  const reasonKey = resolveBillingReason({
    code: event.reason_code,
    error_message: event.error_message
  })
  return {
    ...state,
    step: reasonKey.startsWith('declined_') ? 'declined' : 'processing_error',
    reasonKey,
    actionUrl: undefined
  }
}
