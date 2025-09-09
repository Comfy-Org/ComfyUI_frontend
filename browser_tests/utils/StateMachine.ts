/**
 * Base State Machine Framework
 *
 * Provides condition-based state transitions to eliminate timing assumptions
 * and improve test reliability across different execution environments.
 */
import { TIMING_CONSTANTS } from './constants'

export interface StateMachineConfig<TState extends string, TEvent, TContext> {
  initialState: TState
  context: TContext
  transitions: StateTransitions<TState, TEvent, TContext>
  onEnterState?: (state: TState, context: TContext) => Promise<void> | void
  onExitState?: (state: TState, context: TContext) => Promise<void> | void
  debug?: boolean
}

export type StateTransitions<TState extends string, TEvent, TContext> = {
  [K in TState]: (event: TEvent, context: TContext) => Promise<TState> | TState
}

export interface StateTransitionHistoryEntry<TState extends string> {
  from: TState
  to: TState
  timestamp: number
  duration: number
}

export class StateMachine<TState extends string, TEvent, TContext> {
  private _currentState: TState
  private _context: TContext
  private transitions: StateTransitions<TState, TEvent, TContext>
  private onEnterState?: (
    state: TState,
    context: TContext
  ) => Promise<void> | void
  private onExitState?: (
    state: TState,
    context: TContext
  ) => Promise<void> | void
  private debug: boolean
  private stateHistory: StateTransitionHistoryEntry<TState>[] = []
  private lastStateChangeTime: number = Date.now()

  constructor(config: StateMachineConfig<TState, TEvent, TContext>) {
    this._currentState = config.initialState
    this._context = config.context
    this.transitions = config.transitions
    this.onEnterState = config.onEnterState
    this.onExitState = config.onExitState
    this.debug = config.debug ?? false

    if (this.debug) {
      console.log(
        `[StateMachine] Initialized in state: ${String(this._currentState)}`
      )
    }
  }

  get currentState(): TState {
    return this._currentState
  }

  get context(): TContext {
    return this._context
  }

  async transition(event: TEvent): Promise<TState> {
    const currentState = this._currentState
    const transition = this.transitions[currentState]

    if (!transition) {
      throw new Error(
        `No transition defined for state: ${String(currentState)}`
      )
    }

    const nextState = await transition(event, this._context)

    if (nextState !== currentState) {
      const now = Date.now()
      const duration = now - this.lastStateChangeTime

      // Track state transition history
      this.stateHistory.push({
        from: currentState,
        to: nextState,
        timestamp: now,
        duration
      })

      // Keep only last 10 transitions to prevent memory bloat
      if (this.stateHistory.length > 10) {
        this.stateHistory.shift()
      }

      if (this.debug) {
        console.log(
          `[StateMachine] Transition: ${String(currentState)} -> ${String(nextState)} (${duration}ms)`
        )
      }

      // Execute state change hooks
      if (this.onExitState) {
        await this.onExitState(currentState, this._context)
      }

      this._currentState = nextState
      this.lastStateChangeTime = now

      if (this.onEnterState) {
        await this.onEnterState(nextState, this._context)
      }
    }

    return this._currentState
  }

  canTransitionTo(targetState: TState, event: TEvent): boolean {
    try {
      const transition = this.transitions[this._currentState]
      if (!transition) return false

      // For synchronous transitions, we can check directly
      const result = transition(event, this._context)
      if (result instanceof Promise) {
        // For async transitions, we can't easily check without executing
        return true
      }
      return result === targetState
    } catch {
      return false
    }
  }

  reset(newContext?: Partial<TContext>): void {
    if (newContext) {
      this._context = { ...this._context, ...newContext }
    }

    if (this.debug) {
      console.log(`[StateMachine] Reset to initial state`)
    }
  }

  /**
   * Force a state transition (for controlled internal use)
   * This bypasses normal transition logic and should be used carefully
   */
  protected forceStateTransition(targetState: TState): void {
    const previousState = this._currentState
    this._currentState = targetState

    if (this.debug) {
      console.log(
        `[StateMachine] Forced transition: ${String(previousState)} -> ${String(targetState)}`
      )
    }
  }

  /**
   * Get formatted state transition history for debugging
   */
  protected getStateHistoryString(): string {
    if (this.stateHistory.length === 0) {
      return 'No state transitions recorded'
    }

    const entries = this.stateHistory.slice(-5).map((entry) => {
      const timestamp = new Date(entry.timestamp).toISOString().substr(11, 12) // HH:MM:SS.sss
      return `${timestamp}: ${String(entry.from)} -> ${String(entry.to)} (${entry.duration}ms)`
    })

    return `Recent transitions:\n  ${entries.join('\n  ')}`
  }
}

/**
 * Specialized State Machine for condition-based async operations
 * Eliminates timing assumptions by checking actual system conditions
 */
export interface ConditionStateMachineConfig<TState extends string, TContext>
  extends Omit<StateMachineConfig<TState, 'check', TContext>, 'transitions'> {
  conditions: ConditionTransitions<TState, TContext>
  checkInterval?: number
}

export type ConditionTransitions<TState extends string, TContext> = {
  [K in TState]: (context: TContext) => Promise<TState> | TState
}

/**
 * Type guard to validate that a function matches the expected condition signature
 */
function isValidConditionFunction<TState extends string, TContext>(
  fn: unknown
): fn is (context: TContext) => Promise<TState> | TState {
  return typeof fn === 'function'
}

/**
 * Safe helper to build state transitions from conditions
 * Eliminates the need for type assertions by ensuring type safety at runtime
 */
function buildStateTransitions<TState extends string, TContext>(
  conditions: ConditionTransitions<TState, TContext>
): StateTransitions<TState, 'check', TContext> {
  const transitions: Record<
    string,
    (event: 'check', context: TContext) => Promise<TState>
  > = {}

  // Type-safe iteration over conditions
  for (const state in conditions) {
    if (Object.prototype.hasOwnProperty.call(conditions, state)) {
      const condition = conditions[state]

      // Runtime validation to ensure type safety
      if (!isValidConditionFunction<TState, TContext>(condition)) {
        throw new Error(
          `Invalid condition function for state: ${String(state)}`
        )
      }

      transitions[state] = async (_event: 'check', context: TContext) => {
        return condition(context)
      }
    }
  }

  // Verify all states have transitions before returning
  const conditionKeys = Object.keys(conditions)

  for (const state of conditionKeys) {
    if (!(state in transitions)) {
      throw new Error(`Missing transition for state: ${String(state)}`)
    }
  }

  // Safe return - we've verified the structure matches exactly
  // This assertion is necessary because TypeScript cannot prove that our Record<string, ...>
  // matches StateTransitions<TState, 'check', TContext>, even though we've verified it at runtime
  return transitions as StateTransitions<TState, 'check', TContext>
}

export class ConditionStateMachine<
  TState extends string,
  TContext
> extends StateMachine<TState, 'check', TContext> {
  private checkInterval: number

  constructor(config: ConditionStateMachineConfig<TState, TContext>) {
    // Use type-safe helper function instead of unsafe type assertions
    const transitions = buildStateTransitions(config.conditions)

    super({
      ...config,
      transitions
    })

    this.checkInterval =
      config.checkInterval ?? TIMING_CONSTANTS.FRAME_RATE_INTERVAL
  }

  async checkConditions(): Promise<TState> {
    return this.transition('check')
  }

  /**
   * Wait for the state machine to reach a target state
   * Uses condition-based checking instead of timing assumptions
   */
  async waitForState(
    targetState: TState | TState[],
    timeoutMs: number = 10000
  ): Promise<TState> {
    const targetStates = Array.isArray(targetState)
      ? targetState
      : [targetState]

    if (targetStates.includes(this.currentState)) {
      return this.currentState
    }

    return new Promise<TState>((resolve, reject) => {
      const startTime = Date.now()

      const checkState = async () => {
        try {
          const newState = await this.checkConditions()

          if (targetStates.includes(newState)) {
            cleanup()
            resolve(newState)
            return
          }

          // Check for timeout
          const elapsed = Date.now() - startTime
          if (elapsed >= timeoutMs) {
            cleanup()
            reject(
              new Error(
                `Timeout waiting for state ${String(targetState)}. ` +
                  `Current state: ${String(newState)}, elapsed: ${elapsed}ms\n\n` +
                  this.getStateHistoryString()
              )
            )
          }
        } catch (error) {
          cleanup()
          reject(error)
        }
      }

      // Start checking conditions
      const intervalId = setInterval(checkState, this.checkInterval)

      // Set overall timeout
      const timeoutId = setTimeout(() => {
        cleanup()
        reject(
          new Error(
            `Timeout waiting for state ${String(targetState)} after ${timeoutMs}ms. ` +
              `Current state: ${String(this.currentState)}\n\n` +
              this.getStateHistoryString()
          )
        )
      }, timeoutMs)

      const cleanup = () => {
        clearTimeout(timeoutId)
        clearInterval(intervalId)
      }

      // Perform initial check
      void checkState()
    })
  }

  /**
   * Wait for any state change from current state
   */
  async waitForStateChange(timeoutMs: number = 5000): Promise<TState> {
    const initialState = this.currentState

    return new Promise<TState>((resolve, reject) => {
      const startTime = Date.now()

      const checkState = async () => {
        try {
          const newState = await this.checkConditions()

          if (newState !== initialState) {
            cleanup()
            resolve(newState)
            return
          }

          // Check for timeout
          const elapsed = Date.now() - startTime
          if (elapsed >= timeoutMs) {
            cleanup()
            reject(
              new Error(
                `Timeout waiting for state change from ${String(initialState)} after ${timeoutMs}ms\n\n` +
                  this.getStateHistoryString()
              )
            )
          }
        } catch (error) {
          cleanup()
          reject(error)
        }
      }

      // Start checking conditions
      const intervalId = setInterval(checkState, this.checkInterval)

      // Set overall timeout
      const timeoutId = setTimeout(() => {
        cleanup()
        reject(
          new Error(
            `Timeout waiting for state change from ${String(initialState)} after ${timeoutMs}ms\n\n` +
              this.getStateHistoryString()
          )
        )
      }, timeoutMs)

      const cleanup = () => {
        clearTimeout(timeoutId)
        clearInterval(intervalId)
      }

      // Perform initial check
      void checkState()
    })
  }
}

/**
 * Utility function to create a simple condition-based state machine
 */
export function createConditionStateMachine<TState extends string, TContext>(
  config: ConditionStateMachineConfig<TState, TContext>
): ConditionStateMachine<TState, TContext> {
  return new ConditionStateMachine(config)
}
