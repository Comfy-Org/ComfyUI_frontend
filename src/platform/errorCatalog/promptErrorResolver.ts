import type { ResolvedErrorMessage, RunErrorMessageSource } from './types'

import type { ErrorResolveContext } from './catalogI18n'
import { translateCatalogMessage } from './catalogI18n'
import { resolveRuntimeCatalogCopy } from './runtimeErrorCopy'
import { resolveRuntimeCatalogMatch } from './runtimeErrorMatcher'
import { st } from '@/i18n'

// Resolves prompt-level errors and non-node-scoped failures before falling
// back to prompt-specific catalog keys.
const KNOWN_PROMPT_ERROR_TYPES = new Set([
  'prompt_no_outputs',
  'no_prompt',
  'server_error',
  'missing_node_type',
  'prompt_outputs_failed_validation',
  'agent_draft_apply_failed'
])

function getPromptExceptionMessage(
  error: Extract<RunErrorMessageSource, { kind: 'prompt' }>['error']
): string {
  const message = error.message.trim()
  const prefixedType = `${error.type}: `
  return message.startsWith(prefixedType)
    ? message.slice(prefixedType.length).trim()
    : message
}

export function resolvePromptErrorMessage(
  error: Extract<RunErrorMessageSource, { kind: 'prompt' }>['error'],
  context: ErrorResolveContext
): ResolvedErrorMessage {
  const promptExceptionMessage = getPromptExceptionMessage(error)
  const runtimeMatch = resolveRuntimeCatalogMatch({
    exceptionType: error.type,
    exceptionMessage: promptExceptionMessage
  })
  if (runtimeMatch) {
    // Leave toast copy to node-scoped errors where a node-specific
    // action/message is safe.
    return resolveRuntimeCatalogCopy(
      runtimeMatch.catalogId,
      promptExceptionMessage || error.message,
      context,
      {
        includeToast: false,
        params: runtimeMatch.params,
        detailsFallback: runtimeMatch.detailsFallback
      }
    )
  }

  if (!KNOWN_PROMPT_ERROR_TYPES.has(error.type)) return {}

  const errorTypeKey =
    error.type === 'server_error'
      ? context.isCloud
        ? 'server_error_cloud'
        : 'server_error_local'
      : error.type

  return {
    displayTitle: translateCatalogMessage(
      `errorCatalog.promptErrors.${errorTypeKey}.title`,
      error.message
    ),
    displayMessage: st(
      `errorCatalog.promptErrors.${errorTypeKey}.desc`,
      error.message
    )
  }
}
