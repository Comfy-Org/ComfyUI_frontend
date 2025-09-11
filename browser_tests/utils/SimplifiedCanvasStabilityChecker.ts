/**
 * Simplified Canvas Stability Checker
 *
 * Preserves all proven stability algorithms from the complex state machine
 * implementation while eliminating framework overhead.
 *
 * Key preserved features:
 * - Consecutive stability checks to prevent false positives
 * - Comprehensive instability detection (all current checks)
 * - CI environment adaptation with timeout multipliers
 * - Detailed error context for debugging
 */
import { Page } from '@playwright/test'

import { TIMING_CONSTANTS } from './constants'

type CanvasState =
  | 'initializing' // App/extensions not ready yet
  | 'loading' // Network operations, widget refresh, etc.
  | 'checking' // Running consecutive stability checks
  | 'stable' // Ready for interaction
  | 'error' // Unrecoverable error state

interface StabilityConditions {
  appReady: boolean
  hasLoadingOperations: boolean
  hasInstabilities: boolean
  instabilityReasons: string[]
  hasUnrecoverableErrors: boolean
  errorReasons: string[]
}

export class SimplifiedCanvasStabilityChecker {
  private state: CanvasState = 'initializing'
  private consecutiveStableChecks = 0
  private readonly requiredStableChecks: number
  private readonly debug: boolean

  constructor(
    private page: Page,
    options: {
      requiredStableChecks?: number
      debug?: boolean
    } = {}
  ) {
    this.requiredStableChecks =
      options.requiredStableChecks ??
      TIMING_CONSTANTS.STABILITY.DEFAULT_REQUIRED_CHECKS
    this.debug = options.debug ?? false
  }

  get currentState(): CanvasState {
    return this.state
  }

  async waitForStable(timeoutMs = 10000): Promise<void> {
    const adaptiveTimeout = this.getAdaptiveTimeout(timeoutMs)
    const startTime = Date.now()
    let lastConditions: StabilityConditions | null = null

    if (this.debug) {
      console.log(
        `[SimplifiedCanvasStability] Starting wait with ${adaptiveTimeout}ms timeout`
      )
    }

    while (Date.now() - startTime < adaptiveTimeout) {
      lastConditions = await this.checkConditions()
      this.updateState(lastConditions)

      if (this.state === 'stable') {
        if (this.debug) {
          console.log(
            `[SimplifiedCanvasStability] Stable after ${Date.now() - startTime}ms`
          )
        }
        return
      }

      if (this.state === 'error') {
        throw new Error(
          this.buildErrorMessage(lastConditions, Date.now() - startTime)
        )
      }

      await this.waitForNextFrame()
    }

    // Timeout
    throw new Error(this.buildTimeoutMessage(lastConditions, adaptiveTimeout))
  }

  private updateState(conditions: StabilityConditions): void {
    const previousState = this.state

    if (!conditions.appReady) {
      this.state = 'initializing'
      this.consecutiveStableChecks = 0
    } else if (conditions.hasUnrecoverableErrors) {
      this.state = 'error'
      this.consecutiveStableChecks = 0
    } else if (conditions.hasLoadingOperations) {
      this.state = 'loading'
      this.consecutiveStableChecks = 0
    } else if (conditions.hasInstabilities) {
      this.state = 'checking'
      this.consecutiveStableChecks = 0
    } else {
      // No instabilities detected
      if (this.state === 'checking') {
        this.consecutiveStableChecks++
        if (this.consecutiveStableChecks >= this.requiredStableChecks) {
          this.state = 'stable'
        }
      } else {
        this.state = 'checking'
        this.consecutiveStableChecks = 1
      }
    }

    if (this.debug && this.state !== previousState) {
      console.log(
        `[SimplifiedCanvasStability] State: ${previousState} -> ${this.state}`
      )
    }
  }

  private async waitForNextFrame(): Promise<void> {
    // Use requestAnimationFrame for better synchronization with rendering cycle
    return await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    })
  }

  private async checkConditions(): Promise<StabilityConditions> {
    return await this.page.evaluate(() => {
      const instabilityReasons: string[] = []
      const errorReasons: string[] = []

      // Check app initialization
      const app = window['app']
      if (!app) {
        instabilityReasons.push('app_missing')
        return {
          appReady: false,
          hasLoadingOperations: false,
          hasInstabilities: true,
          instabilityReasons,
          hasUnrecoverableErrors: false,
          errorReasons
        }
      }

      if (!app.graph) {
        instabilityReasons.push('graph_missing')
        return {
          appReady: false,
          hasLoadingOperations: false,
          hasInstabilities: true,
          instabilityReasons,
          hasUnrecoverableErrors: false,
          errorReasons
        }
      }

      if (!app.extensionManager) {
        instabilityReasons.push('extension_manager_missing')
        return {
          appReady: false,
          hasLoadingOperations: false,
          hasInstabilities: true,
          instabilityReasons,
          hasUnrecoverableErrors: false,
          errorReasons
        }
      }

      // App is ready, now check for loading operations
      let hasLoadingOperations = false

      // Check extension manager loading state
      if ((app.extensionManager as any)?.isLoading === true) {
        instabilityReasons.push('extensions_loading')
        hasLoadingOperations = true
      }

      // Check workflow busy state
      if ((app.extensionManager as any)?.workflow?.isBusy === true) {
        instabilityReasons.push('workflow_busy')
        hasLoadingOperations = true
      }

      // Check for remote widget loading (ComfyUI-specific)
      if (app.graph.nodes && Array.isArray(app.graph.nodes)) {
        for (const node of app.graph.nodes) {
          if (!node.widgets) continue

          for (const widget of node.widgets) {
            if ((widget as any)?.isRemote && (widget as any)?.isLoading) {
              instabilityReasons.push('remote_widgets_loading')
              hasLoadingOperations = true
              break
            }
          }

          // Check for combo widget refreshing (R key operation)
          if ((node as any).comboWidget?.isRefreshing) {
            instabilityReasons.push('combo_refreshing')
            hasLoadingOperations = true
          }

          if (hasLoadingOperations) break
        }
      }

      // If we have loading operations, don't check other instabilities yet
      if (hasLoadingOperations) {
        return {
          appReady: true,
          hasLoadingOperations: true,
          hasInstabilities: true,
          instabilityReasons,
          hasUnrecoverableErrors: false,
          errorReasons
        }
      }

      // Check traditional instabilities
      if ((app.graph as any).dirty === true) {
        instabilityReasons.push('graph_dirty')
      }

      if (
        (app.canvas as any)?.rendering === true ||
        app.canvas?.is_rendering === true
      ) {
        instabilityReasons.push('canvas_rendering')
      }

      // Check widget states
      if (app.graph.nodes && Array.isArray(app.graph.nodes)) {
        for (const node of app.graph.nodes) {
          if (!node.widgets) continue

          for (const widget of node.widgets) {
            if ((widget as any)?.pending === true) {
              instabilityReasons.push('widget_pending')
              break
            }
            if ((widget as any)?.updating === true) {
              instabilityReasons.push('widget_updating')
              break
            }
          }

          if (instabilityReasons.some((r) => r.startsWith('widget_'))) {
            break
          }
        }
      }

      // Check for active animations
      const hasActiveAnimations = document
        .getAnimations()
        .some((anim) => anim.playState === 'running')
      if (hasActiveAnimations) {
        instabilityReasons.push('animations_running')
      }

      // Check document loading state
      if (document.readyState !== 'complete') {
        instabilityReasons.push('document_loading')
      }

      // Check for performance issues (basic jank detection)
      if (typeof performance !== 'undefined' && performance.now) {
        const currentTime = performance.now()

        // Initialize performance tracking
        if (!(window as any).__canvasStabilityPerf) {
          ;(window as any).__canvasStabilityPerf = {
            lastCheckTime: currentTime,
            longTaskCount: 0
          }
        } else {
          const perf = (window as any).__canvasStabilityPerf
          const timeDiff = currentTime - perf.lastCheckTime

          // If more than 50ms has passed between checks, consider it a long task
          // This is a simple heuristic for frame drops/jank
          if (timeDiff > 50) {
            perf.longTaskCount++

            // If we've had multiple long tasks recently, flag as jank
            if (perf.longTaskCount >= 3) {
              instabilityReasons.push('performance_jank')
            }
          } else {
            // Reset count if we have a fast frame
            perf.longTaskCount = Math.max(0, perf.longTaskCount - 1)
          }

          perf.lastCheckTime = currentTime
        }
      }

      // Check for WebGL context stability and canvas dimension changes
      const canvas = (app.canvas as any)?.canvas || (app.canvas as any)?.el
      if (canvas && canvas.getContext) {
        try {
          const gl = canvas.getContext('webgl') || canvas.getContext('webgl2')
          if (gl && gl.isContextLost()) {
            instabilityReasons.push('webgl_context_lost')
            errorReasons.push('WebGL context lost - GPU resources unavailable')
          }
        } catch (error) {
          // WebGL not available or failed to get context
          console.warn('[CanvasStability] WebGL context check failed:', error)
        }

        // Check for canvas dimension changes
        const currentWidth = canvas.width
        const currentHeight = canvas.height
        const currentStyleWidth = canvas.style.width
        const currentStyleHeight = canvas.style.height

        // Store previous dimensions and devicePixelRatio in a persistent location
        const currentPixelRatio = window.devicePixelRatio || 1

        if (!(window as any).__canvasStabilityDimensions) {
          ;(window as any).__canvasStabilityDimensions = {
            width: currentWidth,
            height: currentHeight,
            styleWidth: currentStyleWidth,
            styleHeight: currentStyleHeight,
            pixelRatio: currentPixelRatio
          }
        } else {
          const prev = (window as any).__canvasStabilityDimensions

          // Check for dimension changes
          if (
            prev.width !== currentWidth ||
            prev.height !== currentHeight ||
            prev.styleWidth !== currentStyleWidth ||
            prev.styleHeight !== currentStyleHeight
          ) {
            instabilityReasons.push('canvas_resizing')
            // Update stored dimensions
            prev.width = currentWidth
            prev.height = currentHeight
            prev.styleWidth = currentStyleWidth
            prev.styleHeight = currentStyleHeight
          }

          // Check for devicePixelRatio changes (high-DPI display transitions)
          if (prev.pixelRatio !== currentPixelRatio) {
            instabilityReasons.push('display_scale_changing')
            prev.pixelRatio = currentPixelRatio
          }
        }
      }

      // Check for unrecoverable errors
      const hasUnrecoverableErrors = errorReasons.length > 0

      return {
        appReady: true,
        hasLoadingOperations: false,
        hasInstabilities: instabilityReasons.length > 0,
        instabilityReasons,
        hasUnrecoverableErrors,
        errorReasons
      }
    })
  }

  private getAdaptiveTimeout(requestedTimeout: number): number {
    // Preserve CI adaptation logic from original implementation
    const isCI =
      typeof process !== 'undefined' &&
      (process.env.CI === 'true' ||
        process.env.GITHUB_ACTIONS === 'true' ||
        process.env.GITLAB_CI === 'true')

    const minTimeout = TIMING_CONSTANTS.STABILITY.MIN_TIMEOUT

    if (requestedTimeout < minTimeout) {
      if (isCI) {
        return Math.max(
          requestedTimeout *
            TIMING_CONSTANTS.STABILITY.CI_MIN_TIMEOUT_MULTIPLIER,
          minTimeout
        )
      } else {
        return Math.max(requestedTimeout, minTimeout)
      }
    }

    return isCI
      ? Math.floor(
          requestedTimeout * TIMING_CONSTANTS.STABILITY.CI_TIMEOUT_MULTIPLIER
        )
      : requestedTimeout
  }

  private buildErrorMessage(
    conditions: StabilityConditions | null,
    elapsedMs: number
  ): string {
    if (!conditions) {
      return 'Canvas stability check failed - no condition data available'
    }

    const errorDetails = conditions.errorReasons.join(', ')
    return `Canvas entered error state after ${elapsedMs}ms. Errors: ${errorDetails}`
  }

  private buildTimeoutMessage(
    conditions: StabilityConditions | null,
    timeoutMs: number
  ): string {
    if (!conditions) {
      return `Canvas stability timeout after ${timeoutMs}ms - no condition data available`
    }

    const stateInfo = `Current state: ${this.state}`
    const checksInfo = `Stable checks: ${this.consecutiveStableChecks}/${this.requiredStableChecks}`
    const reasonsInfo =
      conditions.instabilityReasons.length > 0
        ? `Instabilities: ${conditions.instabilityReasons.join(', ')}`
        : 'No instabilities detected'

    return `Canvas stability timeout after ${timeoutMs}ms. ${stateInfo}, ${checksInfo}. ${reasonsInfo}`
  }

  /**
   * Reset the checker state (useful for test cleanup)
   */
  reset(): void {
    this.state = 'initializing'
    this.consecutiveStableChecks = 0
  }

  /**
   * Get detailed stability information for debugging
   */
  async getStabilityInfo(): Promise<{
    state: CanvasState
    consecutiveStableChecks: number
    requiredStableChecks: number
    conditions: StabilityConditions
  }> {
    const conditions = await this.checkConditions()

    // Update state based on current conditions (for testing purposes)
    this.updateState(conditions)

    return {
      state: this.state,
      consecutiveStableChecks: this.consecutiveStableChecks,
      requiredStableChecks: this.requiredStableChecks,
      conditions
    }
  }
}
