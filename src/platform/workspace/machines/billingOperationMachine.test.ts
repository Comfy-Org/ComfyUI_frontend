/**
 * Model-based tests for billingOperationMachine.
 *
 * Instead of enumerating scenarios by hand, these generate every path the state
 * graph admits from a declared response space, then assert invariants at every
 * state each path visits. Hand-written tests cover the paths someone thought
 * of; these cover the paths the machine actually has.
 *
 * `createTestModel` rejects machines containing `invoke`, so paths come from
 * `getShortestPaths` and are walked directly.
 */
import { getShortestPaths } from '@xstate/graph'
import { describe, expect, it } from 'vitest'
import type { SnapshotFrom } from 'xstate'

import type { BillingOpStatusResponse } from '@/platform/workspace/api/workspaceApi'

import type {
  BillingOperationInput,
  BillingOperationType
} from './billingOperationContext'
import {
  ACTION_REQUIRED_INTERVAL_MS,
  INITIAL_INTERVAL_MS,
  MAX_INTERVAL_MS
} from './billingOperationContext'
import { timeoutBudgetMs } from './billingOperationGuards'
import { billingOperationMachine } from './billingOperationMachine'

const ACTION_URL = 'https://verify.example/token'
const STARTED_AT = 1_000_000
const DAY_MS = 24 * 60 * 60_000

const WAITING_NODE_ID = billingOperationMachine.states.polling.states.waiting.id
const POLL_ELAPSED = `xstate.after.pollDelay.${WAITING_NODE_ID}`
const FETCH_DONE = 'xstate.done.actor.fetchStatus'
const FETCH_ERROR = 'xstate.error.actor.fetchStatus'

const OPERATION_TYPES: BillingOperationType[] = [
  'subscription',
  'topup',
  'cancel'
]

type BillingOperationSnapshot = SnapshotFrom<typeof billingOperationMachine>

function response(
  overrides: Partial<BillingOpStatusResponse> = {}
): BillingOpStatusResponse {
  return {
    id: 'op-1',
    status: 'pending',
    started_at: new Date(STARTED_AT).toISOString(),
    ...overrides
  }
}

/**
 * The response space a poll can return. Traversal fans out over all of these at
 * every `requesting` state, so response and machine state are explored in
 * combination rather than sampled.
 */
const EXPLORED_EVENTS = [
  ...[
    response(),
    response({ action_url: ACTION_URL }),
    response({ action_url: 'http://verify.example/token' }),
    response({ status: 'succeeded' }),
    response({ status: 'failed', error_message: 'card declined' })
  ].map((output) => ({ type: FETCH_DONE, output })),
  { type: FETCH_ERROR, error: new Error('network') },
  { type: POLL_ELAPSED }
]

interface ModelOptions {
  now: number
  type?: BillingOperationType
  workspaceInactive?: boolean
  initialActionUrl?: string
}

function pathsFor(options: ModelOptions) {
  const machine = billingOperationMachine.provide({
    guards: { isWorkspaceInactive: () => options.workspaceInactive ?? false }
  })
  const input: BillingOperationInput = {
    opId: 'op-1',
    type: options.type ?? 'subscription',
    workspaceId: 'workspace-1',
    startedAt: STARTED_AT,
    initialActionUrl: options.initialActionUrl,
    readNow: () => options.now
  }
  return getShortestPaths(machine, {
    events: EXPLORED_EVENTS,
    limit: 500,
    input
  })
}

/** Time never advances, so the budget is never exhausted. */
const withinBudget: ModelOptions = { now: STARTED_AT }
/** Time is far past any budget, so every evaluation is overdue. */
const pastBudget: ModelOptions = { now: STARTED_AT + DAY_MS }

function assertInvariants(snapshot: BillingOperationSnapshot) {
  const { context } = snapshot

  const isTerminal =
    snapshot.matches('succeeded') ||
    snapshot.matches('failed') ||
    snapshot.matches('timedOut')

  if (isTerminal) {
    // The original store maintained this by hand on every terminal write.
    expect(context.actionUrl).toBeNull()
    return
  }

  // An action URL can only be present once authentication has been seen, and
  // seeing it pins the cadence instead of letting backoff continue.
  if (context.authenticationRequiredSeen) {
    expect([INITIAL_INTERVAL_MS, ACTION_REQUIRED_INTERVAL_MS]).toContain(
      context.intervalMs
    )
  } else {
    expect(context.actionUrl).toBeNull()
    expect(context.intervalMs).toBeLessThanOrEqual(MAX_INTERVAL_MS)
  }
}

function walk(options: ModelOptions) {
  const paths = pathsFor(options)
  const visited = new Set<string>()

  for (const path of paths) {
    for (const step of path.steps) {
      assertInvariants(step.state)
      visited.add(JSON.stringify(step.state.value))
    }
    assertInvariants(path.state)
    visited.add(JSON.stringify(path.state.value))
  }

  return { paths, visited }
}

function reachedStates(options: ModelOptions) {
  return walk(options).visited
}

const REQUESTING = JSON.stringify({ polling: 'requesting' })
const WAITING = JSON.stringify({ polling: 'waiting' })
const EVALUATING = JSON.stringify({ polling: 'evaluating' })
const SUCCEEDED = JSON.stringify('succeeded')
const FAILED = JSON.stringify('failed')
const TIMED_OUT = JSON.stringify('timedOut')

describe('billingOperationMachine model', () => {
  it('holds its invariants across every path within budget', () => {
    const { paths, visited } = walk(withinBudget)

    expect(paths.length).toBeGreaterThan(0)
    expect([...visited]).toEqual(
      expect.arrayContaining([REQUESTING, WAITING, SUCCEEDED, FAILED])
    )
  })

  it('never lets an operation outlive a spent budget', () => {
    const visited = reachedStates(pastBudget)

    expect([...visited]).toContain(TIMED_OUT)
    expect([...visited]).not.toContain(SUCCEEDED)
    expect([...visited]).not.toContain(FAILED)
  })

  it('issues no request on any path while the workspace is inactive', () => {
    const visited = reachedStates({ ...withinBudget, workspaceInactive: true })

    expect([...visited]).not.toContain(REQUESTING)
    expect([...visited]).toContain(WAITING)
  })

  it.for(OPERATION_TYPES)(
    'times out a %s operation exactly at its own budget',
    (type) => {
      const budget = timeoutBudgetMs({
        type,
        authenticationRequiredSeen: false
      })

      const atBudget = reachedStates({ now: STARTED_AT + budget, type })
      const pastIt = reachedStates({ now: STARTED_AT + budget + 1, type })

      expect([...atBudget]).not.toContain(TIMED_OUT)
      expect([...pastIt]).toContain(TIMED_OUT)
      expect([...pastIt]).not.toContain(REQUESTING)
    }
  )

  it('grants a recovered subscription the long authentication budget', () => {
    const pastDiscovery =
      STARTED_AT +
      timeoutBudgetMs({
        type: 'subscription',
        authenticationRequiredSeen: false
      }) +
      1

    const visited = reachedStates({
      now: pastDiscovery,
      type: 'subscription',
      initialActionUrl: ACTION_URL
    })

    expect([...visited]).not.toContain(TIMED_OUT)
    expect([...visited]).toContain(REQUESTING)
  })

  it('polls a recovered operation at the action cadence from the first wait', () => {
    const paths = pathsFor({ ...withinBudget, initialActionUrl: ACTION_URL })

    for (const path of paths) {
      for (const step of path.steps) {
        if (step.state.matches({ polling: 'waiting' })) {
          expect(step.state.context.intervalMs).toBe(
            ACTION_REQUIRED_INTERVAL_MS
          )
        }
      }
    }
  })

  it('never shortens the poll interval along any path', () => {
    for (const path of pathsFor(withinBudget)) {
      let previous = 0
      for (const step of path.steps) {
        expect(step.state.context.intervalMs).toBeGreaterThanOrEqual(previous)
        previous = step.state.context.intervalMs
      }
    }
  })

  it('covers every settleable state across the budget models', () => {
    const reachable = new Set<string>()
    for (const options of [withinBudget, pastBudget]) {
      for (const key of reachedStates(options)) reachable.add(key)
    }

    // `evaluating` is transient: its `always` transitions resolve within the
    // same microstep, so it is never observable as a settled snapshot.
    expect([...reachable]).not.toContain(EVALUATING)
    expect([...reachable].sort()).toEqual(
      [REQUESTING, WAITING, SUCCEEDED, FAILED, TIMED_OUT].sort()
    )
  })
})
