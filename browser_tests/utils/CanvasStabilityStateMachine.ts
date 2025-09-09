/**
 * Canvas Stability State Machine
 *
 * Replaces timing-based waitForCanvasStable with condition-based state transitions.
 * Eliminates environment-dependent timing assumptions and safety overrides.
 */
import { Page } from '@playwright/test'

import {
  ConditionStateMachine,
  createConditionStateMachine
} from './StateMachine'
import { TIMING_CONSTANTS } from './constants'

export enum CanvasState {
  INITIALIZING = 'initializing',
  CHECKING = 'checking',
  STABLE = 'stable',
  UNSTABLE = 'unstable'
}

export interface CanvasContext {
  page: Page
  consecutiveStableChecks: number
  requiredStableChecks: number
  lastCheckTime: number
  debug: boolean
}

export interface CanvasStabilityConfig {
  page: Page
  requiredStableChecks?: number
  debug?: boolean
}

/**
 * Creates a canvas stability state machine that eliminates timing assumptions
 */
export function createCanvasStabilityStateMachine(
  config: CanvasStabilityConfig
): ConditionStateMachine<CanvasState, CanvasContext> {
  const context: CanvasContext = {
    page: config.page,
    consecutiveStableChecks: 0,
    requiredStableChecks:
      config.requiredStableChecks ??
      TIMING_CONSTANTS.STABILITY.DEFAULT_REQUIRED_CHECKS,
    lastCheckTime: 0,
    debug: config.debug ?? false
  }

  return createConditionStateMachine({
    initialState: CanvasState.INITIALIZING,
    context,
    debug: config.debug,
    checkInterval: TIMING_CONSTANTS.FRAME_RATE_INTERVAL,

    conditions: {
      [CanvasState.INITIALIZING]: async (ctx) => {
        const isAppReady = await checkAppInitialization(ctx.page)
        if (isAppReady) {
          if (ctx.debug)
            console.log(
              '[CanvasStability] App initialized, starting stability checks'
            )
          return CanvasState.CHECKING
        }
        return CanvasState.INITIALIZING
      },

      [CanvasState.CHECKING]: async (ctx) => {
        const instabilityReasons = await detectInstabilities(ctx.page)

        if (instabilityReasons.length > 0) {
          if (ctx.debug) {
            console.log(
              '[CanvasStability] Instabilities detected:',
              instabilityReasons
            )
          }
          ctx.consecutiveStableChecks = 0
          return CanvasState.UNSTABLE
        }

        // All stability checks passed
        ctx.consecutiveStableChecks++
        ctx.lastCheckTime = Date.now()

        if (ctx.consecutiveStableChecks >= ctx.requiredStableChecks) {
          if (ctx.debug) {
            console.log(
              `[CanvasStability] Stable after ${ctx.consecutiveStableChecks} consecutive checks`
            )
          }
          return CanvasState.STABLE
        }

        if (ctx.debug && ctx.consecutiveStableChecks % 10 === 0) {
          console.log(
            `[CanvasStability] Stable checks: ${ctx.consecutiveStableChecks}/${ctx.requiredStableChecks}`
          )
        }

        return CanvasState.CHECKING
      },

      [CanvasState.UNSTABLE]: async (ctx) => {
        const instabilityReasons = await detectInstabilities(ctx.page)

        if (instabilityReasons.length === 0) {
          if (ctx.debug)
            console.log(
              '[CanvasStability] Instabilities resolved, resuming checks'
            )
          return CanvasState.CHECKING
        }

        return CanvasState.UNSTABLE
      },

      [CanvasState.STABLE]: async (ctx) => {
        // Re-verify stability to handle dynamic changes
        const instabilityReasons = await detectInstabilities(ctx.page)

        if (instabilityReasons.length > 0) {
          if (ctx.debug)
            console.log(
              '[CanvasStability] Stability lost, returning to checking'
            )
          ctx.consecutiveStableChecks = 0
          return CanvasState.UNSTABLE
        }

        return CanvasState.STABLE
      }
    }
  })
}

/**
 * Safe wrapper for page.evaluate that handles closed page contexts
 */
async function safePageEvaluate<T>(
  page: Page,
  pageFunction: () => T,
  defaultValue: T
): Promise<T> {
  try {
    return await page.evaluate(pageFunction)
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes('Target page, context or browser has been closed')
    ) {
      // Return default value when page is closed
      return defaultValue
    }
    // Re-throw other errors
    throw error
  }
}

/**
 * Check if the ComfyUI app is fully initialized
 */
async function checkAppInitialization(page: Page): Promise<boolean> {
  return await safePageEvaluate(
    page,
    () => {
      // Import the validation function in the browser context
      const validateState = () => {
        try {
          const app = window['app']
          return !!(app && app.extensionManager && app.graph)
        } catch {
          return false
        }
      }
      return validateState()
    },
    false
  )
}

/**
 * Detect all current instabilities in the canvas system
 * Returns array of reasons for instability (empty array = stable)
 */
async function detectInstabilities(page: Page): Promise<string[]> {
  return await safePageEvaluate(page, () => {
    const instabilities: string[] = []

    try {
      // Use centralized app state validation pattern
      const getApp = () => {
        try {
          const app = window['app']
          return app && app.graph && app.extensionManager ? app : null
        } catch {
          return null
        }
      }

      const app = getApp()
      const graph = app?.graph

      // Check for missing required objects
      if (!app) {
        instabilities.push('app_missing')
        return instabilities
      }
      if (!graph) {
        instabilities.push('graph_missing')
        return instabilities
      }

      // Check graph state
      if (graph.dirty === true) {
        instabilities.push('graph_dirty')
      }

      // Check canvas rendering state
      if (app.canvas?.rendering === true) {
        instabilities.push('canvas_rendering')
      }

      // Check extension manager workflow state
      if (app.extensionManager?.workflow?.isBusy === true) {
        instabilities.push('workflow_busy')
      }

      // Check widget states
      if (graph.nodes && Array.isArray(graph.nodes)) {
        for (const node of graph.nodes) {
          if (!node.widgets) continue

          for (const widget of node.widgets) {
            if (widget?.pending === true) {
              instabilities.push('widget_pending')
              break
            }
            if (widget?.updating === true) {
              instabilities.push('widget_updating')
              break
            }
          }

          // Break early if we found widget instability
          if (instabilities.some((r) => r.startsWith('widget_'))) {
            break
          }
        }
      }

      // Check for active animations or transitions
      const hasActiveAnimations = document
        .getAnimations()
        .some((anim) => anim.playState === 'running')
      if (hasActiveAnimations) {
        instabilities.push('animations_running')
      }

      // Check for pending network requests (optional - might be too strict)
      // This could help detect when remote widgets are still loading
      if (document.readyState !== 'complete') {
        instabilities.push('document_loading')
      }
    } catch (error) {
      // If stability checking itself fails, assume unstable
      instabilities.push('check_error: ' + String(error))
    }

    return instabilities
  }, [])
}

/**
 * Enhanced canvas stability checker with comprehensive condition validation
 *
 * This class provides the main API that replaces the timing-based waitForCanvasStable
 */
export class CanvasStabilityChecker {
  private stateMachine: ConditionStateMachine<CanvasState, CanvasContext>

  constructor(config: CanvasStabilityConfig) {
    this.stateMachine = createCanvasStabilityStateMachine(config)
  }

  get currentState(): CanvasState {
    return this.stateMachine.currentState
  }

  get context(): CanvasContext {
    return this.stateMachine.context
  }

  /**
   * Calculate adaptive timeout based on environment and context
   * Provides longer timeouts for CI/mobile environments where rendering may be slower
   */
  private getAdaptiveTimeout(requestedTimeout: number): number {
    // Detect CI environment
    const isCI =
      typeof process !== 'undefined' &&
      (process.env.CI === 'true' ||
        process.env.GITHUB_ACTIONS === 'true' ||
        process.env.GITLAB_CI === 'true')

    // Minimum reasonable timeout for stability checking
    const minTimeout = TIMING_CONSTANTS.STABILITY.MIN_TIMEOUT

    if (requestedTimeout < minTimeout) {
      if (isCI) {
        // In CI, use at least 3x the minimum for better reliability
        return Math.max(
          requestedTimeout *
            TIMING_CONSTANTS.STABILITY.CI_MIN_TIMEOUT_MULTIPLIER,
          minTimeout
        )
      } else {
        // Locally, still enforce minimum but be less aggressive
        return Math.max(requestedTimeout, minTimeout)
      }
    }

    // For larger timeouts, add CI buffer
    return isCI
      ? Math.floor(
          requestedTimeout * TIMING_CONSTANTS.STABILITY.CI_TIMEOUT_MULTIPLIER
        )
      : requestedTimeout
  }

  /**
   * Wait for canvas to reach stable state
   * Replaces timing-based waitForCanvasStable with condition-based checking
   */
  async waitForStable(timeoutMs: number = 10000): Promise<void> {
    const adaptiveTimeout = this.getAdaptiveTimeout(timeoutMs)
    await this.stateMachine.waitForState(CanvasState.STABLE, adaptiveTimeout)
  }

  /**
   * Check current stability without waiting
   */
  async checkStability(): Promise<CanvasState> {
    return this.stateMachine.checkConditions()
  }

  /**
   * Reset the stability checker (useful between tests)
   */
  reset(): void {
    this.stateMachine.reset({
      consecutiveStableChecks: 0,
      lastCheckTime: 0
    })
  }

  /**
   * Get detailed stability information for debugging
   */
  async getStabilityInfo(): Promise<{
    state: CanvasState
    consecutiveStableChecks: number
    requiredStableChecks: number
    instabilities: string[]
  }> {
    const state = await this.checkStability()
    const instabilities = await detectInstabilities(this.context.page)

    return {
      state,
      consecutiveStableChecks: this.context.consecutiveStableChecks,
      requiredStableChecks: this.context.requiredStableChecks,
      instabilities
    }
  }
}
