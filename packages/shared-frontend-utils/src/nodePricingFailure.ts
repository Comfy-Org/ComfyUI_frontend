/**
 * Pricing expressions arrive from backend and custom node definitions, so a
 * malformed one is a data problem the host app wants in its telemetry. This
 * package has no telemetry dependency, so the host registers a reporter the
 * way `src/base/assert.ts` takes one via `setAssertReporter`.
 */
export interface NodePricingFailure {
  operation: 'compile' | 'evaluate' | 'format'
  /** Node type name the rule belongs to. */
  nodeType: string
  /** Which host surface ran the rule. */
  source: 'live_node' | 'node_definition' | 'pricing_context'
  expr: string
  /** The original JSONata error. */
  cause: unknown
}

export type NodePricingFailureReporter = (failure: NodePricingFailure) => void

let failureReporter: NodePricingFailureReporter | null = null

/**
 * Register a reporter for pricing rule failures. Called once at app startup by
 * platform/ or higher layers. Passing `null` restores console-only reporting.
 */
export function setNodePricingFailureReporter(
  fn: NodePricingFailureReporter | null
): void {
  failureReporter = fn
}

function logToConsole(failure: NodePricingFailure): void {
  console.error(
    `[pricing/jsonata] failed to ${failure.operation} expr for ${failure.nodeType}:`,
    failure.expr,
    failure.cause
  )
}

/**
 * Never throws: a failing reporter must not take down pricing rendering.
 */
export function reportNodePricingFailure(failure: NodePricingFailure): void {
  if (!failureReporter) {
    logToConsole(failure)
    return
  }
  try {
    failureReporter(failure)
  } catch (reporterFailure) {
    console.error('[pricing/jsonata] reporter failed', reporterFailure)
    logToConsole(failure)
  }
}
