import { CancelFlowMachine, ChurnkeyApi } from '@churnkey/react/core'
import type { ChurnkeyFlowResponse } from '@comfyorg/ingest-types'

import { t } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import {
  workspaceApi,
  WorkspaceApiError
} from '@/platform/workspace/api/workspaceApi'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useDialogStore } from '@/stores/dialogStore'

import ChurnkeyFlowDialog from './ChurnkeyFlowDialog.vue'
import { churnkeyCoreSchema } from './churnkeyCoreSchema'
import type { ChurnkeyHandlerResult, ChurnkeySessionOutcome } from './types'

function confirmedNoWrite(error: unknown): boolean {
  if (!(error instanceof WorkspaceApiError)) return false
  return new Set([
    'RETENTION_SESSION_STALE',
    'RETENTION_NOT_ALLOWED',
    'RETENTION_ALREADY_REDEEMED',
    'RETENTION_UNAVAILABLE',
    'PREVIOUS_OPERATION_FAILED'
  ]).has(error.code ?? '')
}

class ChurnkeyActionError extends Error {
  readonly recoverable = true
}

export interface ChurnkeyShowOptions {
  workspaceId?: string
  isWorkspaceCurrent?: () => boolean
  handleCancel: (
    surveyResponse?: string | null,
    freeformFeedback?: string | null
  ) => Promise<ChurnkeyHandlerResult>
}
export interface ChurnkeySession {
  show: (options: ChurnkeyShowOptions) => Promise<ChurnkeySessionOutcome>
}

function createSession(flow: ChurnkeyFlowResponse): ChurnkeySession {
  const config = churnkeyCoreSchema.parse(flow.sdk_config)
  if (
    config.customer.id !== flow.customer_id ||
    config.subscriptions[0]?.id !== flow.subscription.id
  ) {
    throw new ChurnkeyActionError(
      'Cancellation configuration does not match the prepared subscription'
    )
  }
  return {
    show: (options) =>
      new Promise<ChurnkeySessionOutcome>((resolve) => {
        const dialogs = useDialogStore()
        const key = `churnkey-${flow.session_id}`
        let action: Promise<void> | undefined
        let outcome: ChurnkeySessionOutcome | undefined
        let closing = false
        let removed = false
        let redemptionAttempted = false
        let uncertain: 'discount' | 'cancel' | undefined
        const recorded = new Set<string>()

        function record(event: 'flow_opened' | 'offer_shown') {
          if (recorded.has(event) || options.isWorkspaceCurrent?.() === false)
            return
          recorded.add(event)
          void workspaceApi
            .recordChurnkeyFlowEvent({ session_id: flow.session_id, event })
            .catch((error) => {
              reportError(error, {
                surface: 'billing',
                errorType: 'churnkey_exposure_failed'
              })
            })
        }
        function assertScope() {
          if (options.isWorkspaceCurrent?.() === false)
            throw new ChurnkeyActionError(
              t('subscription.cancelDialog.workspaceChanged')
            )
        }
        function runAction(
          kind: 'discount' | 'cancel',
          run: () => Promise<void>
        ): Promise<void> {
          if (
            action ||
            closing ||
            outcome ||
            (uncertain && uncertain !== kind)
          ) {
            return Promise.reject(
              new Error(t('subscription.cancelDialog.retentionBusy'))
            )
          }
          const pending = Promise.resolve()
            .then(() => {
              assertScope()
              return run()
            })
            .then(() => {
              uncertain = undefined
              outcome = {
                type: kind === 'discount' ? 'discount-applied' : 'closed'
              }
            })
            .catch((error) => {
              reportError(error, {
                surface: 'billing',
                errorType: 'churnkey_billing_action_failed',
                tags: { action: kind }
              })
              throw error
            })
            .finally(() => {
              action = undefined
            })
          action = pending
          return pending
        }
        async function applyDiscount() {
          if (!flow.allowed_offer)
            throw new ChurnkeyActionError(
              t('subscription.cancelDialog.offerUnavailable')
            )
          if (!redemptionAttempted && Date.now() >= flow.expires_at * 1000)
            throw new ChurnkeyActionError(
              t('subscription.cancelDialog.retentionExpired')
            )
          redemptionAttempted = true
          uncertain = 'discount'
          try {
            const acceptance = await workspaceApi.acceptChurnkeyRetention(
              flow.session_id
            )
            if (acceptance.status === 'succeeded') return
            const terminal = await useBillingOperationStore().startOperation(
              acceptance.billing_op_id,
              'retention',
              { workspaceId: options.workspaceId }
            )
            if (terminal.status === 'succeeded') return
            if (terminal.status === 'failed') uncertain = undefined
            throw new ChurnkeyActionError(
              t(
                uncertain
                  ? 'subscription.cancelDialog.retentionPending'
                  : 'subscription.cancelDialog.retentionFailed'
              )
            )
          } catch (error) {
            if (confirmedNoWrite(error)) uncertain = undefined
            throw error
          }
        }
        async function finish() {
          if (closing) return
          closing = true
          await action?.catch(() => undefined)
          machine.close()
          machine.destroy()
          resolve(
            outcome ?? { type: uncertain ? 'billing-pending' : 'abandoned' }
          )
          if (!removed) dialogs.closeDialog({ key })
        }
        const credentials = {
          appId: flow.app_id,
          customerId: flow.customer_id,
          subscriptionId: flow.subscription.id,
          authHash: flow.auth_hash,
          mode: flow.mode,
          issuedAt: Math.floor(Date.now() / 1000)
        }
        const session = `ck_${btoa(
          JSON.stringify({
            a: credentials.appId,
            c: credentials.customerId,
            s: credentials.subscriptionId,
            h: credentials.authHash,
            m: credentials.mode,
            t: credentials.issuedAt
          })
        )
          .replaceAll('+', '-')
          .replaceAll('/', '_')
          .replaceAll('=', '')}`
        const unsupported = () =>
          Promise.reject(
            new Error(t('subscription.cancelDialog.offerUnavailable'))
          )
        const machine = new CancelFlowMachine({
          session,
          handleDiscount: () => runAction('discount', applyDiscount),
          handleCancel: () =>
            runAction('cancel', async () => {
              if (uncertain)
                throw new ChurnkeyActionError(
                  t('subscription.cancelDialog.retentionPending')
                )
              uncertain = 'cancel'
              await options.handleCancel(
                machine.getSnapshot().selectedReason,
                machine.getSnapshot().feedback
              )
            }),
          handlePause: unsupported,
          handlePlanChange: unsupported,
          handleTrialExtension: unsupported,
          handleRebate: unsupported,
          onStepChange: (step) => {
            if (step === 'offer') record('offer_shown')
          }
        })
        machine.initializeFromConfig(
          config,
          new ChurnkeyApi(credentials),
          credentials
        )
        dialogs.showDialog({
          key,
          title: t('subscription.cancelDialog.title'),
          component: ChurnkeyFlowDialog,
          props: {
            machine,
            onClose: () => {
              void finish()
            },
            canCancel: () => !uncertain,
            pendingMessage: () =>
              uncertain
                ? t('subscription.cancelDialog.retentionPending')
                : undefined
          },
          dialogComponentProps: {
            size: 'sm',
            dismissableMask: false,
            onRemoved: () => {
              removed = true
              void finish()
            }
          }
        })
        record('flow_opened')
        if (machine.getSnapshot().step === 'offer') record('offer_shown')
      })
  }
}

export async function prepareChurnkey(): Promise<ChurnkeySession | null> {
  try {
    return createSession(await workspaceApi.prepareChurnkeyFlow())
  } catch (error) {
    if (
      error instanceof WorkspaceApiError &&
      error.status !== undefined &&
      [403, 422, 503].includes(error.status)
    )
      return null
    throw error
  }
}
