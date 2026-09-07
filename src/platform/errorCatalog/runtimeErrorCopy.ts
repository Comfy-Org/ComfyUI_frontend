import type { ResolvedCatalogErrorMessage } from './types'

import {
  normalizeNodeName,
  translateCatalogMessage,
  translateOptionalCatalogMessage
} from './catalogI18n'
import type { CatalogParams, ErrorResolveContext } from './catalogI18n'

// Builds resolved display fields while callers keep the raw API message/details
// on the ErrorItem.
export function resolveRuntimeCatalogCopy(
  catalogId: string,
  fallbackMessage: string,
  context: ErrorResolveContext,
  options: {
    includeItemLabel?: boolean
    includeToast?: boolean
    params?: CatalogParams
    detailsFallback?: string
  } = {}
): ResolvedCatalogErrorMessage {
  const keyPrefix = `errorCatalog.runtimeErrors.${catalogId}`
  const nodeName = normalizeNodeName(context.nodeDisplayName)
  const params = { nodeName, ...options.params }
  const resolveMessage = (suffix: string, fallback = fallbackMessage) =>
    translateCatalogMessage(`${keyPrefix}.${suffix}`, fallback, params)

  const displayMessage = resolveMessage('message')
  const result: ResolvedCatalogErrorMessage = {
    catalogId,
    displayTitle: resolveMessage('title'),
    displayMessage
  }

  if (options.includeToast !== false) {
    result.toastTitle = resolveMessage('toastTitle')
    result.toastMessage = resolveMessage('toastMessage')
  }

  const displayDetails = translateOptionalCatalogMessage(
    `${keyPrefix}.details`,
    options.detailsFallback,
    params
  )
  if (displayDetails) result.displayDetails = displayDetails

  if (options.includeItemLabel) {
    result.displayItemLabel = resolveMessage('itemLabel', nodeName)
  }

  return result
}
