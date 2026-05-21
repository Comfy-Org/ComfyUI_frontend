import type {
  MissingErrorMessageSource,
  NodeValidationError,
  ResolvedErrorMessage,
  ResolvedMissingErrorMessage,
  RunErrorMessageSource
} from './types'
import { st, t, te } from '@/i18n'

const REQUIRED_INPUT_MISSING_TYPE = 'required_input_missing'
const REQUIRED_INPUT_MISSING_CATALOG_ID = 'missing_connection'
const EXECUTION_FAILED_CATALOG_ID = 'execution_failed'
const KNOWN_PROMPT_ERROR_TYPES = new Set([
  'prompt_no_outputs',
  'no_prompt',
  'server_error'
])

interface ErrorResolveContext {
  isCloud?: boolean
  nodeDisplayName?: string
}

function translateCatalogMessage(
  key: string,
  fallback: string,
  params?: Record<string, string | number>
): string {
  if (te(key)) return params ? t(key, params) : t(key)
  if (!params) return fallback

  return fallback.replace(/\{(\w+)\}/g, (match, paramName) =>
    params[paramName] === undefined ? match : String(params[paramName])
  )
}

function normalizeNodeName(nodeDisplayName: string | undefined): string {
  return (
    nodeDisplayName?.trim() ||
    translateCatalogMessage('errorCatalog.fallbacks.nodeName', 'This node')
  )
}

function getInputName(error: NodeValidationError): string {
  const inputName = error.extra_info?.input_name ?? error.details
  return (
    inputName?.trim() ||
    translateCatalogMessage('errorCatalog.fallbacks.inputName', 'unknown input')
  )
}

function isRequiredInputMissing(
  error: NodeValidationError
): error is NodeValidationError & { type: typeof REQUIRED_INPUT_MISSING_TYPE } {
  return error.type === REQUIRED_INPUT_MISSING_TYPE
}

function resolveNodeValidationErrorMessage(
  error: NodeValidationError,
  context: ErrorResolveContext
): ResolvedErrorMessage {
  if (!isRequiredInputMissing(error)) return {}

  const nodeName = normalizeNodeName(context.nodeDisplayName)
  const inputName = getInputName(error)
  const keyPrefix = 'errorCatalog.validationErrors.required_input_missing'

  return {
    catalogId: REQUIRED_INPUT_MISSING_CATALOG_ID,
    displayTitle: translateCatalogMessage(
      `${keyPrefix}.title`,
      'Missing connection'
    ),
    displayMessage: translateCatalogMessage(
      `${keyPrefix}.message`,
      'Required input slots have no connection feeding them.'
    ),
    displayDetails: translateCatalogMessage(
      `${keyPrefix}.details`,
      '{nodeName} is missing a required input: {inputName}',
      { nodeName, inputName }
    ),
    displayItemLabel: translateCatalogMessage(
      `${keyPrefix}.itemLabel`,
      '{nodeName} - {inputName}',
      { nodeName, inputName }
    ),
    toastTitle: translateCatalogMessage(
      `${keyPrefix}.toastTitle`,
      'Required input missing'
    ),
    toastMessage: translateCatalogMessage(
      `${keyPrefix}.toastMessage`,
      '{nodeName} is missing a required input: {inputName}',
      { nodeName, inputName }
    )
  }
}

function resolveExecutionErrorMessage(
  context: ErrorResolveContext
): ResolvedErrorMessage {
  const nodeName = normalizeNodeName(context.nodeDisplayName)
  const keyPrefix = 'errorCatalog.runtimeErrors.execution_failed'
  const toastMessageKey = context.isCloud
    ? `${keyPrefix}.toastMessageCloud`
    : `${keyPrefix}.toastMessageLocal`
  const toastMessageFallback = context.isCloud
    ? 'This node threw an error during execution. Check its inputs or try a different configuration. No credits charged.'
    : 'This node threw an error during execution. Check its inputs or try a different configuration.'

  return {
    catalogId: EXECUTION_FAILED_CATALOG_ID,
    displayItemLabel: translateCatalogMessage(
      `${keyPrefix}.itemLabel`,
      nodeName,
      {
        nodeName
      }
    ),
    toastTitle: translateCatalogMessage(
      `${keyPrefix}.toastTitle`,
      '{nodeName} failed',
      { nodeName }
    ),
    toastMessage: translateCatalogMessage(
      toastMessageKey,
      toastMessageFallback,
      { nodeName }
    )
  }
}

function resolvePromptErrorMessage(
  error: Extract<RunErrorMessageSource, { kind: 'prompt' }>['error'],
  context: ErrorResolveContext
): ResolvedErrorMessage {
  if (!KNOWN_PROMPT_ERROR_TYPES.has(error.type)) return {}

  const errorTypeKey =
    error.type === 'server_error'
      ? context.isCloud
        ? 'server_error_cloud'
        : 'server_error_local'
      : error.type

  return {
    displayMessage: st(
      `errorCatalog.promptErrors.${errorTypeKey}.desc`,
      error.message
    )
  }
}

function formatCountTitle(title: string, count: number): string {
  return `${title} (${count})`
}

function translateMissingModelOverlayMessage(count: number): string {
  const translated = t('errorOverlay.missingModels', { count }, count)
  return translated === 'errorOverlay.missingModels'
    ? `${count} required ${count === 1 ? 'model is' : 'models are'} missing`
    : translated
}

export function resolveMissingErrorMessage(
  source: MissingErrorMessageSource
): ResolvedMissingErrorMessage {
  switch (source.kind) {
    case 'missing_node':
      return {
        catalogId: 'missing_node',
        displayTitle: formatCountTitle(
          source.isCloud
            ? st(
                'rightSidePanel.missingNodePacks.unsupportedTitle',
                'Unsupported Node Packs'
              )
            : st('rightSidePanel.missingNodePacks.title', 'Missing Node Packs'),
          source.count
        ),
        displayMessage: st(
          'errorOverlay.missingNodes',
          'Some nodes are missing and need to be installed'
        )
      }
    case 'swap_nodes':
      return {
        catalogId: 'swap_nodes',
        displayTitle: formatCountTitle(
          st('nodeReplacement.swapNodesTitle', 'Swap Nodes'),
          source.count
        ),
        displayMessage: st(
          'errorOverlay.swapNodes',
          'Some nodes can be replaced with alternatives'
        )
      }
    case 'missing_model':
      return {
        catalogId: 'missing_model',
        displayTitle: formatCountTitle(
          st(
            'rightSidePanel.missingModels.missingModelsTitle',
            'Missing Models'
          ),
          source.count
        ),
        displayMessage: translateMissingModelOverlayMessage(source.count)
      }
    case 'missing_media':
      return {
        catalogId: 'missing_media',
        displayTitle: formatCountTitle(
          st('rightSidePanel.missingMedia.missingMediaTitle', 'Missing Inputs'),
          source.count
        ),
        displayMessage: st(
          'errorOverlay.missingMedia',
          'Some nodes are missing required inputs'
        )
      }
  }
}

export function resolveRunErrorMessage(
  source: RunErrorMessageSource
): ResolvedErrorMessage {
  switch (source.kind) {
    case 'node_validation':
      return resolveNodeValidationErrorMessage(source.error, {
        nodeDisplayName: source.nodeDisplayName
      })
    case 'execution':
      return resolveExecutionErrorMessage({
        isCloud: source.isCloud,
        nodeDisplayName: source.nodeDisplayName
      })
    case 'prompt':
      return resolvePromptErrorMessage(source.error, {
        isCloud: source.isCloud
      })
  }
}
