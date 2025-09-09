/**
 * Retry State Machine
 *
 * Replaces timing-based retry logic with condition-based state transitions.
 * Eliminates exponential backoff timing assumptions that fail in CI environments.
 */
import {
  ConditionStateMachine,
  createConditionStateMachine
} from './StateMachine'
import { TIMING_CONSTANTS } from './constants'

export enum RetryState {
  IDLE = 'idle',
  FETCHING = 'fetching',
  ERROR = 'error',
  BACKING_OFF = 'backing_off',
  FAILED = 'failed',
  SUCCESS = 'success'
}

export interface RetryContext<T = any> {
  attemptCount: number
  maxRetries: number
  lastError?: Error | null
  lastAttemptTime: number
  lastSuccessData?: T
  backoffStartTime: number
  debug: boolean
  // Function to check if system is ready for next retry
  systemReadinessCheck?: () => Promise<boolean> | boolean
}

export interface RetryConfig<T = any> {
  maxRetries?: number
  debug?: boolean
  systemReadinessCheck?: () => Promise<boolean> | boolean
}

/**
 * Creates a retry state machine that eliminates timing assumptions
 */
export function createRetryStateMachine<T = any>(
  config: RetryConfig<T> = {}
): ConditionStateMachine<RetryState, RetryContext<T>> {
  const context: RetryContext<T> = {
    attemptCount: 0,
    maxRetries: config.maxRetries ?? 5,
    lastError: null,
    lastAttemptTime: 0,
    backoffStartTime: 0,
    debug: config.debug ?? false,
    systemReadinessCheck: config.systemReadinessCheck
  }

  return createConditionStateMachine({
    initialState: RetryState.IDLE,
    context,
    debug: config.debug,
    checkInterval: TIMING_CONSTANTS.RETRY_CHECK_INTERVAL,

    conditions: {
      [RetryState.IDLE]: (ctx) => {
        // Stay idle until explicitly triggered
        return RetryState.IDLE
      },

      [RetryState.FETCHING]: (ctx) => {
        // This state is managed externally by the fetch operation
        // The state machine doesn't transition automatically from FETCHING
        return RetryState.FETCHING
      },

      [RetryState.ERROR]: async (ctx) => {
        // Determine if we should retry based on error type and attempt count
        if (ctx.attemptCount >= ctx.maxRetries) {
          if (ctx.debug) {
            console.log(
              `[RetryStateMachine] Max retries (${ctx.maxRetries}) exceeded`
            )
          }
          return RetryState.FAILED
        }

        if (!isRetryableError(ctx.lastError)) {
          if (ctx.debug) {
            console.log(
              `[RetryStateMachine] Non-retryable error:`,
              ctx.lastError?.message
            )
          }
          return RetryState.FAILED
        }

        // Error is retryable and we haven't exceeded max retries
        ctx.backoffStartTime = Date.now()
        if (ctx.debug) {
          console.log(
            `[RetryStateMachine] Starting backoff for attempt ${ctx.attemptCount + 1}`
          )
        }
        return RetryState.BACKING_OFF
      },

      [RetryState.BACKING_OFF]: async (ctx) => {
        // Check if system is ready for next retry attempt
        const isSystemReady = ctx.systemReadinessCheck
          ? await ctx.systemReadinessCheck()
          : await defaultSystemReadinessCheck(ctx)

        if (isSystemReady) {
          if (ctx.debug) {
            const backoffDuration = Date.now() - ctx.backoffStartTime
            console.log(
              `[RetryStateMachine] System ready after ${backoffDuration}ms, attempting retry`
            )
          }
          ctx.attemptCount++
          return RetryState.FETCHING
        }

        // Not ready yet, continue backing off
        return RetryState.BACKING_OFF
      },

      [RetryState.FAILED]: (ctx) => {
        // Terminal state - stays failed
        return RetryState.FAILED
      },

      [RetryState.SUCCESS]: (ctx) => {
        // Terminal state - stays successful
        return RetryState.SUCCESS
      }
    }
  })
}

/**
 * Determine if an error is retryable based on error type and properties
 */
function isRetryableError(error?: Error | null): boolean {
  if (!error) return false

  const message = error.message.toLowerCase()

  // Retryable network/server errors
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  ) {
    return true
  }

  // Non-retryable client errors
  if (
    message.includes('400') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('404') ||
    message.includes('invalid') ||
    message.includes('unauthorized')
  ) {
    return false
  }

  // Default to retryable for unknown errors
  return true
}

/**
 * Default system readiness check - uses minimum backoff timing
 * This maintains some timing element but much more conservative than exponential backoff
 */
async function defaultSystemReadinessCheck<T>(
  ctx: RetryContext<T>
): Promise<boolean> {
  const backoffDuration = Date.now() - ctx.backoffStartTime

  // Progressive backoff based on attempt count, but much shorter than traditional exponential
  // Attempt 1: 100ms, Attempt 2: 200ms, Attempt 3: 400ms, etc.
  // This provides some backoff without the long delays that cause CI failures
  const minBackoffTime = Math.min(
    TIMING_CONSTANTS.BACKOFF.MIN_BASE_TIME *
      Math.pow(TIMING_CONSTANTS.BACKOFF.MULTIPLIER, ctx.attemptCount - 1),
    TIMING_CONSTANTS.BACKOFF.MAX_CAP_TIME
  )

  return backoffDuration >= minBackoffTime
}

/**
 * Enhanced retry state machine with built-in fetch functionality
 */
export class RetryStateMachine<T = any> {
  private stateMachine: ConditionStateMachine<RetryState, RetryContext<T>>

  constructor(config: RetryConfig<T> = {}) {
    this.stateMachine = createRetryStateMachine(config)
  }

  get currentState(): RetryState {
    return this.stateMachine.currentState
  }

  get context(): RetryContext<T> {
    return this.stateMachine.context
  }

  /**
   * Execute a fetch operation with automatic retry logic
   */
  async executeFetch(
    fetchFn: () => Promise<T>,
    timeoutMs: number = 10000
  ): Promise<T> {
    // Reset state machine for new operation
    this.reset()

    while (
      this.currentState !== RetryState.SUCCESS &&
      this.currentState !== RetryState.FAILED
    ) {
      if (
        this.currentState === RetryState.IDLE ||
        this.currentState === RetryState.BACKING_OFF
      ) {
        // Wait for ready state (either initial idle or after backoff)
        await this.stateMachine.waitForState(RetryState.FETCHING, timeoutMs)
      }

      if (this.currentState === RetryState.FETCHING) {
        try {
          // Attempt the fetch operation
          const result = await fetchFn()

          // Success - update context and transition
          this.context.lastSuccessData = result
          this.context.lastError = null
          await this.transitionTo(RetryState.SUCCESS)

          return result
        } catch (error) {
          // Error - update context and transition to error handling
          this.context.lastError =
            error instanceof Error ? error : new Error(String(error))
          this.context.lastAttemptTime = Date.now()
          await this.transitionTo(RetryState.ERROR)

          // Let the state machine determine next action (retry or fail)
          await this.stateMachine.checkConditions()
        }
      }
    }

    // Check final state
    if (
      this.currentState === RetryState.SUCCESS &&
      this.context.lastSuccessData
    ) {
      return this.context.lastSuccessData
    }

    // Failed - throw the last error or a generic failure
    const error =
      this.context.lastError ||
      new Error(`Retry failed after ${this.context.attemptCount} attempts`)
    throw error
  }

  /**
   * Start a retry operation (for manual control)
   */
  async startRetry(timeoutMs: number = 5000): Promise<void> {
    if (this.currentState === RetryState.IDLE) {
      await this.transitionTo(RetryState.FETCHING)
    } else if (this.currentState === RetryState.BACKING_OFF) {
      await this.stateMachine.waitForState(RetryState.FETCHING, timeoutMs)
    }
  }

  /**
   * Report success (for manual control)
   */
  async reportSuccess(data: T): Promise<void> {
    this.context.lastSuccessData = data
    this.context.lastError = null
    await this.transitionTo(RetryState.SUCCESS)
  }

  /**
   * Report error (for manual control)
   */
  async reportError(error: Error): Promise<void> {
    this.context.lastError = error
    this.context.lastAttemptTime = Date.now()
    await this.transitionTo(RetryState.ERROR)
  }

  /**
   * Wait for final state (success or failure)
   */
  async waitForCompletion(timeoutMs: number = 30000): Promise<T> {
    await this.stateMachine.waitForState(
      [RetryState.SUCCESS, RetryState.FAILED],
      timeoutMs
    )

    if (
      this.currentState === RetryState.SUCCESS &&
      this.context.lastSuccessData
    ) {
      return this.context.lastSuccessData
    }

    const error = this.context.lastError || new Error('Retry operation failed')
    throw error
  }

  /**
   * Reset the retry state machine
   */
  reset(): void {
    this.stateMachine.reset({
      attemptCount: 0,
      lastError: null,
      lastAttemptTime: 0,
      lastSuccessData: undefined,
      backoffStartTime: 0
    })
  }

  /**
   * Get retry statistics for debugging
   */
  getRetryInfo() {
    return {
      currentState: this.currentState,
      attemptCount: this.context.attemptCount,
      maxRetries: this.context.maxRetries,
      lastError: this.context.lastError?.message,
      hasSuccessData: !!this.context.lastSuccessData
    }
  }

  /**
   * Internal helper to transition to a specific state
   */
  private async transitionTo(targetState: RetryState): Promise<void> {
    // Use the proper protected API for controlled state transitions
    this.stateMachine['forceStateTransition'](targetState)
  }
}
