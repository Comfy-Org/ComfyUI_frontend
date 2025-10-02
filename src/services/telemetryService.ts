import { electronAPI, isElectron } from '@/utils/envUtil'

// Allowed property value types - excludes objects, arrays, and functions to prevent sensitive data leaks
type SafeTelemetryValue = string | number | boolean | undefined

/**
 * Safe telemetry properties interface with runtime validation (sensitive properties blocked in implementation)
 * @public
 */
export interface TelemetryEventProperties {
  [key: string]: SafeTelemetryValue
}

/**
 * Core telemetry service interface
 * @public
 */
export interface TelemetryService {
  trackEvent(eventName: string, properties?: TelemetryEventProperties): void
  incrementUserProperty(propertyName: string, value: number): void
}

/**
 * Unified telemetry service that works in both electron and cloud environments
 *
 * - Electron: Uses existing electronAPI.Events for Mixpanel tracking
 * - Cloud: Placeholder for future Mixpanel web SDK integration
 */
class UnifiedTelemetryService implements TelemetryService {
  private isElectronEnv: boolean
  private isEnabled: boolean
  private samplingRate: number

  constructor() {
    this.isElectronEnv = isElectron()
    this.isEnabled = true // TODO: Add user consent check

    // Simple sampling rate control - can be adjusted via environment variable
    // Mixpanel will handle the actual user sampling and identity management
    this.samplingRate = this.getSamplingRate()
  }

  /**
   * Get sampling rate from environment or default to 100%
   * Set VITE_TELEMETRY_SAMPLING_RATE=0.1 for 10% sampling, etc.
   */
  private getSamplingRate(): number {
    const envRate = import.meta.env.VITE_TELEMETRY_SAMPLING_RATE
    if (envRate) {
      const rate = parseFloat(envRate)
      return Math.max(0, Math.min(1, rate)) // Clamp between 0-1
    }
    return 1.0 // Default: 100% sampling
  }

  /**
   * Check if telemetry should be sent based on sampling rate
   */
  private shouldSample(): boolean {
    if (this.samplingRate >= 1.0) return true
    if (this.samplingRate <= 0) return false
    return Math.random() < this.samplingRate
  }

  /**
   * Track a user event with optional properties
   * Completely fail-safe - will never throw errors or break app flow
   */
  trackEvent(
    eventName: string,
    properties: TelemetryEventProperties = {}
  ): void {
    // Enhanced validation: fail silently if disabled, invalid input, or not in sample
    if (
      !this.isEnabled ||
      !eventName ||
      typeof eventName !== 'string' ||
      eventName.trim().length === 0 ||
      eventName.length > 200 || // Prevent excessively long event names
      !this.shouldSample()
    ) {
      return
    }

    try {
      // Additional input validation and type casting for external API
      const safeProperties =
        properties && typeof properties === 'object' ? properties : {}

      if (this.isElectronEnv) {
        // Use existing electron telemetry infrastructure
        electronAPI().Events.trackEvent(
          eventName,
          safeProperties as Record<string, unknown>
        )
      } else {
        // Cloud environment - placeholder for Mixpanel web SDK
        this.trackCloudEvent(eventName, safeProperties)
      }
    } catch (error) {
      // Absolutely silent failure in production - telemetry must never break the app
      if (import.meta.env.DEV) {
        console.warn('[Telemetry] Service tracking failed:', error)
      }
    }
  }

  /**
   * Increment a user property (typically for counting behaviors)
   * Completely fail-safe - will never throw errors or break app flow
   */
  incrementUserProperty(propertyName: string, value: number): void {
    // Enhanced validation: fail silently if disabled or invalid input
    if (
      !this.isEnabled ||
      !propertyName ||
      typeof propertyName !== 'string' ||
      propertyName.trim().length === 0 ||
      propertyName.length > 100 // Prevent excessively long property names
    ) {
      return
    }

    try {
      // Validate and sanitize numeric value
      const safeValue = typeof value === 'number' && isFinite(value) ? value : 1

      if (this.isElectronEnv) {
        electronAPI().Events.incrementUserProperty(propertyName, safeValue)
      } else {
        // Cloud environment - placeholder for user property updates
        this.incrementCloudUserProperty(propertyName, safeValue)
      }
    } catch (error) {
      // Absolutely silent failure in production - telemetry must never break the app
      if (import.meta.env.DEV) {
        console.warn(
          '[Telemetry] Service user property increment failed:',
          error
        )
      }
    }
  }

  /**
   * Enable or disable telemetry tracking
   * Completely fail-safe - will never throw errors or break app flow
   */
  setEnabled(enabled: boolean): void {
    try {
      this.isEnabled = Boolean(enabled)
    } catch (error) {
      // Absolutely silent failure in production
      if (import.meta.env.DEV) {
        console.warn('[Telemetry] Failed to set enabled state:', error)
      }
    }
  }

  /**
   * Check if telemetry is currently enabled
   */
  getEnabled(): boolean {
    return this.isEnabled
  }

  /**
   * Get current sampling rate (for monitoring/debugging)
   */
  getSamplingInfo(): { rate: number; enabled: boolean } {
    return {
      rate: this.samplingRate,
      enabled: this.isEnabled
    }
  }

  /**
   * Cloud-specific event tracking (placeholder for future implementation)
   */
  private trackCloudEvent(
    eventName: string,
    properties: TelemetryEventProperties
  ): void {
    // TODO: Implement Mixpanel web SDK integration
    // For now, log to console in development
    if (import.meta.env.DEV) {
      console.log('[Telemetry]', eventName, properties)
    }

    // Future implementation:
    // mixpanel.track(eventName, {
    //   ...properties,
    //   platform: 'cloud',
    //   timestamp: new Date().toISOString()
    // })
  }

  /**
   * Cloud-specific user property increment (placeholder)
   */
  private incrementCloudUserProperty(
    propertyName: string,
    value: number
  ): void {
    // TODO: Implement Mixpanel people.increment
    if (import.meta.env.DEV) {
      console.log('[Telemetry] Increment:', propertyName, value)
    }

    // Future implementation:
    // mixpanel.people.increment(propertyName, value)
  }
}

// Singleton instance
/** @public */
export const telemetryService = new UnifiedTelemetryService()

/**
 * Convenience function for tracking events throughout the app
 * Completely fail-safe - will never throw errors or break app flow
 * @public
 */
export function trackEvent(
  eventName: string,
  properties?: TelemetryEventProperties
): void {
  try {
    // Enhanced input validation for edge cases
    if (
      !eventName ||
      typeof eventName !== 'string' ||
      eventName.trim().length === 0
    ) {
      return
    }

    // Sanitize event name - remove potential injection attempts
    const sanitizedEventName = eventName.trim().replace(/[^\w:.-]/g, '_')
    if (sanitizedEventName !== eventName && import.meta.env.DEV) {
      console.warn(
        `[Telemetry] Event name sanitized: "${eventName}" -> "${sanitizedEventName}"`
      )
    }

    // Efficiently filter and sanitize properties
    const safeProperties: TelemetryEventProperties = {}
    if (properties && typeof properties === 'object') {
      // Pre-compile sensitive property patterns for better performance
      const sensitivePatterns = [
        /password/i,
        /token/i,
        /secret/i,
        /key$/i,
        /auth/i,
        /credential/i,
        /email/i,
        /phone/i,
        /ssn/i,
        /credit_card/i
      ]

      for (const [key, value] of Object.entries(properties)) {
        try {
          // Skip potentially sensitive property names
          if (sensitivePatterns.some((pattern) => pattern.test(key))) {
            if (import.meta.env.DEV) {
              console.warn(
                `[Telemetry] Skipped potentially sensitive property: ${key}`
              )
            }
            continue
          }

          // Only include safe primitive values
          if (value !== null && value !== undefined) {
            const valueType = typeof value
            if (
              valueType === 'string' ||
              valueType === 'number' ||
              valueType === 'boolean'
            ) {
              // Additional validation for string length to prevent log bombing
              if (valueType === 'string' && (value as string).length > 1000) {
                safeProperties[key] =
                  (value as string).substring(0, 1000) + '...[truncated]'
              } else if (valueType === 'number' && !isFinite(value as number)) {
                // Skip non-finite numbers (NaN, Infinity)
                continue
              } else {
                safeProperties[key] = value as SafeTelemetryValue
              }
            }
            // Note: We no longer convert complex objects to strings to prevent data leaks
          }
        } catch {
          // Skip properties that can't be serialized
          continue
        }
      }
    }

    telemetryService.trackEvent(sanitizedEventName, safeProperties)
  } catch (error) {
    // Absolutely silent failure - telemetry must never break the app
    // Only log in development to avoid production console noise
    if (import.meta.env.DEV) {
      console.warn('[Telemetry] Silent failure in trackEvent:', error)
    }
  }
}

/**
 * Convenience function for incrementing user properties
 * Completely fail-safe - will never throw errors or break app flow
 * @public
 */
export function incrementUserProperty(
  propertyName: string,
  value: number = 1
): void {
  try {
    // Enhanced input validation for edge cases
    if (
      !propertyName ||
      typeof propertyName !== 'string' ||
      propertyName.trim().length === 0
    ) {
      return
    }

    // Sanitize property name and validate against sensitive patterns
    const sanitizedPropertyName = propertyName.trim().replace(/[^\w:.-]/g, '_')
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key$/i,
      /auth/i,
      /credential/i,
      /email/i,
      /phone/i,
      /ssn/i,
      /credit_card/i
    ]

    if (
      sensitivePatterns.some((pattern) => pattern.test(sanitizedPropertyName))
    ) {
      if (import.meta.env.DEV) {
        console.warn(
          `[Telemetry] Blocked potentially sensitive user property: ${sanitizedPropertyName}`
        )
      }
      return
    }

    if (typeof value !== 'number' || !isFinite(value)) {
      value = 1
    }

    // Clamp value to reasonable bounds to prevent abuse
    const clampedValue = Math.max(
      -1000000,
      Math.min(1000000, Math.round(value))
    )

    telemetryService.incrementUserProperty(sanitizedPropertyName, clampedValue)
  } catch (error) {
    // Absolutely silent failure - telemetry must never break the app
    // Only log in development to avoid production console noise
    if (import.meta.env.DEV) {
      console.warn(
        '[Telemetry] Silent failure in incrementUserProperty:',
        error
      )
    }
  }
}

// Event name constants for type safety and consistency
export const TelemetryEvents = {
  // Template events
  TEMPLATE_BROWSED: 'template:browsed',
  TEMPLATE_USED: 'template:used',

  // Workflow events
  WORKFLOW_CREATED_FROM_TEMPLATE: 'workflow:created_from_template',
  WORKFLOW_CREATED_FROM_SCRATCH: 'workflow:created_from_scratch',
  WORKFLOW_NODE_ADDED: 'workflow:node_added',
  WORKFLOW_SUBMITTED_FROM_UI: 'workflow:submitted_from_ui',
  WORKFLOW_CANCELLED_BY_USER: 'workflow:cancelled_by_user',

  // UI interaction events
  WORKSPACE_FOCUS_MODE_ENABLED: 'workspace:focus_mode_enabled',
  MENU_ITEM_CLICKED: 'menu:item_clicked',
  NODE_TEMPLATE_USED: 'node_template:used',
  SETTINGS_PREFERENCE_CHANGED: 'settings:preference_changed',

  // Sidebar and panel events
  SIDEBAR_PANEL_OPENED: 'sidebar:panel_opened',
  MENU_SUBMENU_ITEM_CLICKED: 'menu:submenu_item_clicked',
  TOOLBOX_ITEM_USED: 'toolbox:item_used',

  // Queue management events
  QUEUE_ITEM_DELETED: 'queue:item_deleted',
  QUEUE_CLEARED: 'queue:cleared',
  QUEUE_EXECUTION_CANCELLED: 'queue:execution_cancelled',
  QUEUE_EXECUTION_STOPPED: 'queue:execution_stopped',

  // Error tracking
  ERROR_MESSAGE_DISPLAYED: 'error:message_displayed',

  // Node creation method comparison
  NODE_ADDED_FROM_SIDEBAR: 'node:added_from_sidebar',
  NODE_ADDED_FROM_SEARCH_POPOVER: 'node:added_from_search_popover',
  NODE_ADDED_FROM_CONTEXT_MENU: 'node:added_from_context_menu',
  NODE_ADDED_FROM_DRAG_DROP: 'node:added_from_drag_drop',

  // Workflow opening method comparison
  WORKFLOW_OPENED_FROM_DRAG_DROP_IMAGE: 'workflow:opened_from_drag_drop_image',
  WORKFLOW_OPENED_FROM_DRAG_DROP_JSON: 'workflow:opened_from_drag_drop_json',
  WORKFLOW_OPENED_FROM_SIDEBAR: 'workflow:opened_from_sidebar',
  WORKFLOW_OPENED_FROM_TEMPLATE: 'workflow:opened_from_template',
  WORKFLOW_OPENED_FROM_FILE_DIALOG: 'workflow:opened_from_file_dialog',

  // Advanced feature discovery
  NODE_COPIED_WITH_ALT_DRAG: 'node:copied_with_alt_drag',
  SLOT_CONNECTION_SHIFT_DRAG: 'slot:connection_shift_drag',
  SLOT_CONNECTION_REMOVED_CTRL_SHIFT: 'slot:connection_removed_ctrl_shift',
  NODE_MUTED: 'node:muted',
  NODE_BYPASSED: 'node:bypassed',
  SUBGRAPH_CREATED: 'subgraph:created',

  // Canvas interactions
  CANVAS_PAN_GESTURE: 'canvas:pan_gesture',
  CANVAS_DOUBLE_CLICK: 'canvas:double_click'
} as const

/**
 * Union type of all telemetry event names
 * @public
 */
export type TelemetryEventName =
  (typeof TelemetryEvents)[keyof typeof TelemetryEvents]

/**
 * Type-safe event tracking with predefined event names
 * Completely fail-safe - will never throw errors or break app flow
 * @public
 */
export function trackTypedEvent(
  eventName: TelemetryEventName,
  properties?: TelemetryEventProperties
): void {
  try {
    // Extra safety layer even though trackEvent is already safe
    if (!eventName) {
      return
    }
    trackEvent(eventName, properties)
  } catch (error) {
    // Absolutely silent failure - telemetry must never break the app
    // Only log in development to avoid production console noise
    if (import.meta.env.DEV) {
      console.warn('[Telemetry] Silent failure in trackTypedEvent:', error)
    }
  }
}
