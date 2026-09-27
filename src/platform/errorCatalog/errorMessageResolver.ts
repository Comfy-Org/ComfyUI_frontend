import type {
  ResolvedCatalogErrorMessage,
  ResolvedErrorMessage,
  RunErrorMessageSource
} from './types'

import { resolveExecutionErrorMessage } from './executionErrorResolver'
import { resolvePromptErrorMessage } from './promptErrorResolver'
import { resolveNodeValidationErrorMessage } from './validationErrorResolver'

// Public facade for error catalog resolution. Source-specific resolver modules
// own the actual matching/copy rules so this file stays as the routing boundary.
export {
  resolveMissingErrorMessage,
  resolveMissingMediaItemLabel
} from './missingErrorResolver'

export function resolveRunErrorMessage(
  source: Extract<RunErrorMessageSource, { kind: 'node_validation' }>
): ResolvedCatalogErrorMessage
export function resolveRunErrorMessage(
  source: Extract<RunErrorMessageSource, { kind: 'execution' }>
): ResolvedCatalogErrorMessage
export function resolveRunErrorMessage(
  source: RunErrorMessageSource
): ResolvedErrorMessage
export function resolveRunErrorMessage(
  source: RunErrorMessageSource
): ResolvedErrorMessage {
  switch (source.kind) {
    case 'node_validation':
      return resolveNodeValidationErrorMessage(source.error, {
        nodeDisplayName: source.nodeDisplayName
      })
    case 'prompt':
      return resolvePromptErrorMessage(source.error, {
        isCloud: source.isCloud
      })
    case 'execution':
      return resolveExecutionErrorMessage(source.error, {
        nodeDisplayName: source.nodeDisplayName
      })
  }
}
