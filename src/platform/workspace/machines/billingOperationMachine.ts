import { assign, fromPromise, setup } from 'xstate'

import type { BillingOpStatusResponse } from '@/platform/workspace/api/workspaceApi'

import {
  nextIntervalMs,
  recordActionUrl,
  recordFailure
} from './billingOperationActions'
import type {
  BillingOperationContext,
  BillingOperationInput
} from './billingOperationContext'
import {
  INITIAL_INTERVAL_MS,
  validateActionUrl
} from './billingOperationContext'
import { hasTimedOut, isFailed, isSucceeded } from './billingOperationGuards'

export const billingOperationMachine = setup({
  types: {
    context: {} as BillingOperationContext,
    input: {} as BillingOperationInput
  },
  actors: {
    fetchStatus: fromPromise<BillingOpStatusResponse, { opId: string }>(() => {
      throw new Error('fetchStatus implementation must be provided')
    })
  },
  guards: {
    // Supplied by the store; a machine with no workspace notion never suspends.
    isWorkspaceInactive: () => false,
    hasTimedOut: ({ context }) => hasTimedOut(context),
    responseSucceeded: (_, params: { response: BillingOpStatusResponse }) =>
      isSucceeded(params.response),
    responseFailed: (_, params: { response: BillingOpStatusResponse }) =>
      isFailed(params.response)
  },
  delays: {
    pollDelay: ({ context }) => context.intervalMs
  },
  actions: {
    advanceInterval: assign({
      intervalMs: ({ context }) => nextIntervalMs(context)
    }),
    clearActionUrl: assign({ actionUrl: null })
  }
}).createMachine({
  id: 'billingOperation',
  context: ({ input }) => ({
    opId: input.opId,
    type: input.type,
    workspaceId: input.workspaceId,
    startedAt: input.startedAt,
    intervalMs: INITIAL_INTERVAL_MS,
    actionUrl: validateActionUrl(input.initialActionUrl),
    authenticationRequiredSeen:
      validateActionUrl(input.initialActionUrl) !== null,
    backendErrorMessage: null,
    readNow: input.readNow ?? Date.now
  }),
  initial: 'polling',
  states: {
    polling: {
      initial: 'evaluating',
      states: {
        // Mirrors the guard cascade at the top of the original poll(): the
        // budget is enforced first, and an operation whose workspace is no
        // longer active waits without issuing a request.
        evaluating: {
          always: [
            { guard: 'hasTimedOut', target: '#billingOperation.timedOut' },
            { guard: 'isWorkspaceInactive', target: 'waiting' },
            { target: 'requesting' }
          ]
        },
        requesting: {
          invoke: {
            // Named so the done and error events have stable types that
            // model-based traversal can enumerate.
            id: 'fetchStatus',
            src: 'fetchStatus',
            input: ({ context }) => ({ opId: context.opId }),
            onDone: [
              // A response landing after a workspace switch is discarded
              // whatever it says, then re-evaluated against the budget.
              { guard: 'isWorkspaceInactive', target: 'evaluating' },
              {
                guard: {
                  type: 'responseSucceeded',
                  params: ({ event }) => ({ response: event.output })
                },
                target: '#billingOperation.succeeded'
              },
              {
                guard: {
                  type: 'responseFailed',
                  params: ({ event }) => ({ response: event.output })
                },
                target: '#billingOperation.failed',
                actions: assign(({ event }) => recordFailure(event.output))
              },
              // Checked after the terminal cases so a terminal response still
              // wins, but before the action URL is recorded so a late one is
              // never surfaced.
              { guard: 'hasTimedOut', target: '#billingOperation.timedOut' },
              {
                target: 'waiting',
                actions: assign(({ context, event }) =>
                  recordActionUrl(context, event.output)
                )
              }
            ],
            onError: [
              { guard: 'hasTimedOut', target: '#billingOperation.timedOut' },
              { target: 'waiting' }
            ]
          }
        },
        waiting: {
          entry: 'advanceInterval',
          after: { pollDelay: { target: 'evaluating' } }
        }
      }
    },
    succeeded: { type: 'final', entry: 'clearActionUrl' },
    failed: { type: 'final', entry: 'clearActionUrl' },
    timedOut: { type: 'final', entry: 'clearActionUrl' }
  }
})
