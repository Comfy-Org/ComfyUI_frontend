import type { ResolvedErrorMessage } from './types'

import {
  ACCESS_REQUIRED_CATALOG_ID,
  CONTENT_BLOCKED_CATALOG_ID,
  EXECUTION_FAILED_CATALOG_ID,
  GENERATION_STALLED_CATALOG_ID,
  IMAGE_NOT_LOADED_CATALOG_ID,
  INSUFFICIENT_CREDITS_CATALOG_ID,
  INVALID_CLIP_INPUT_CATALOG_ID,
  INVALID_PROMPT_CATALOG_ID,
  INVALID_WORKFLOW_REQUEST_CATALOG_ID,
  MODEL_ACCESS_ERROR_CATALOG_ID,
  MODEL_DOWNLOAD_FAILED_CATALOG_ID,
  OUT_OF_MEMORY_CATALOG_ID,
  PREPROCESSING_FAILED_CATALOG_ID,
  PREPROCESSING_TIMEOUT_CATALOG_ID,
  RATE_LIMITED_CATALOG_ID,
  REQUEST_FAILED_CATALOG_ID,
  RUN_ENDED_UNEXPECTEDLY_CATALOG_ID,
  RUN_START_FAILED_CATALOG_ID,
  SERVER_BUSY_CATALOG_ID,
  SERVER_CRASHED_CATALOG_ID,
  SIGN_IN_REQUIRED_CATALOG_ID,
  SUBSCRIPTION_REQUIRED_CATALOG_ID,
  SUBSCRIPTION_UPGRADE_REQUIRED_CATALOG_ID,
  TIMEOUT_CATALOG_ID,
  UNEXPECTED_SERVICE_ERROR_CATALOG_ID,
  WORKSPACE_INSUFFICIENT_CREDITS_CATALOG_ID
} from './catalogIds'
import {
  normalizeNodeName,
  translateCatalogMessage,
  translateOptionalCatalogMessage
} from './catalogI18n'
import type { CatalogParams, ErrorResolveContext } from './catalogI18n'

const NO_CREDITS_CHARGED_KEY = 'errorCatalog.runtimeErrors.noCreditsCharged'
const NO_CREDITS_CHARGED_FALLBACK = 'No credits charged.'

// Keep this opt-in so the credit note is only shown for catalog IDs whose
// product copy explicitly supports it.
const NO_CREDITS_CHARGED_RUNTIME_CATALOG_IDS = new Set([
  ACCESS_REQUIRED_CATALOG_ID,
  CONTENT_BLOCKED_CATALOG_ID,
  EXECUTION_FAILED_CATALOG_ID,
  GENERATION_STALLED_CATALOG_ID,
  IMAGE_NOT_LOADED_CATALOG_ID,
  INSUFFICIENT_CREDITS_CATALOG_ID,
  INVALID_CLIP_INPUT_CATALOG_ID,
  INVALID_PROMPT_CATALOG_ID,
  INVALID_WORKFLOW_REQUEST_CATALOG_ID,
  MODEL_ACCESS_ERROR_CATALOG_ID,
  MODEL_DOWNLOAD_FAILED_CATALOG_ID,
  OUT_OF_MEMORY_CATALOG_ID,
  PREPROCESSING_FAILED_CATALOG_ID,
  PREPROCESSING_TIMEOUT_CATALOG_ID,
  RATE_LIMITED_CATALOG_ID,
  REQUEST_FAILED_CATALOG_ID,
  RUN_ENDED_UNEXPECTEDLY_CATALOG_ID,
  RUN_START_FAILED_CATALOG_ID,
  SERVER_BUSY_CATALOG_ID,
  SERVER_CRASHED_CATALOG_ID,
  SIGN_IN_REQUIRED_CATALOG_ID,
  SUBSCRIPTION_REQUIRED_CATALOG_ID,
  SUBSCRIPTION_UPGRADE_REQUIRED_CATALOG_ID,
  TIMEOUT_CATALOG_ID,
  UNEXPECTED_SERVICE_ERROR_CATALOG_ID,
  WORKSPACE_INSUFFICIENT_CREDITS_CATALOG_ID
])

function appendNoCreditsChargedIfNeeded(
  catalogId: string,
  message: string,
  context: ErrorResolveContext
): string {
  if (
    !context.isCloud ||
    !NO_CREDITS_CHARGED_RUNTIME_CATALOG_IDS.has(catalogId)
  )
    return message

  const note = translateCatalogMessage(
    NO_CREDITS_CHARGED_KEY,
    NO_CREDITS_CHARGED_FALLBACK
  )
  return message.includes(note) ? message : `${message} ${note}`
}

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
): ResolvedErrorMessage {
  const keyPrefix = `errorCatalog.runtimeErrors.${catalogId}`
  const nodeName = normalizeNodeName(context.nodeDisplayName)
  const params = { nodeName, ...options.params }
  const resolveMessage = (suffix: string, fallback = fallbackMessage) =>
    translateCatalogMessage(`${keyPrefix}.${suffix}`, fallback, params)
  const addCloudCreditNote = (message: string) =>
    appendNoCreditsChargedIfNeeded(catalogId, message, context)

  const displayMessage = resolveMessage('message')
  const result: ResolvedErrorMessage = {
    catalogId,
    displayTitle: resolveMessage('title'),
    displayMessage: addCloudCreditNote(displayMessage)
  }

  if (options.includeToast !== false) {
    const toastMessage = resolveMessage('toastMessage')
    result.toastTitle = resolveMessage('toastTitle')
    result.toastMessage = addCloudCreditNote(toastMessage)
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
