import type {
  ResolvedCatalogErrorMessage,
  RunErrorMessageSource
} from './types'

import { EXECUTION_FAILED_CATALOG_ID } from './catalogIds'
import type { ErrorResolveContext } from './catalogI18n'
import { resolveRuntimeCatalogCopy } from './runtimeErrorCopy'
import { resolveRuntimeCatalogMatch } from './runtimeErrorMatcher'

type ExecutionErrorResolveContext = Pick<ErrorResolveContext, 'nodeDisplayName'>

// Resolves node-scoped runtime failures while preserving raw API fields.
export function resolveExecutionErrorMessage(
  error: Extract<RunErrorMessageSource, { kind: 'execution' }>['error'],
  context: ExecutionErrorResolveContext
): ResolvedCatalogErrorMessage {
  const exceptionMessage = error.exception_message.trim()
  const match = resolveRuntimeCatalogMatch({
    exceptionType: error.exception_type,
    exceptionMessage
  })
  if (!match) {
    return resolveRuntimeCatalogCopy(
      EXECUTION_FAILED_CATALOG_ID,
      error.exception_message,
      context,
      { includeItemLabel: true }
    )
  }

  return resolveRuntimeCatalogCopy(
    match.catalogId,
    error.exception_message,
    context,
    {
      includeItemLabel: true,
      params: match.params,
      detailsFallback: match.detailsFallback
    }
  )
}
