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
const IMAGE_NOT_LOADED_CATALOG_ID = 'image_not_loaded'
const OUT_OF_MEMORY_CATALOG_ID = 'out_of_memory'
const KNOWN_PROMPT_ERROR_TYPES = new Set([
  'prompt_no_outputs',
  'no_prompt',
  'server_error',
  'missing_node_type',
  'prompt_outputs_failed_validation'
])

interface ValidationCatalogRule {
  catalogId: string
  key: string
  itemLabel: 'node' | 'nodeInput'
}

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

function translateOptionalCatalogMessage(
  key: string,
  fallback?: string,
  params?: Record<string, string | number>
): string | undefined {
  if (te(key)) return params ? t(key, params) : t(key)
  return fallback?.trim() ? fallback : undefined
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

function getErrorText(error: NodeValidationError) {
  return [
    'message' in error ? error.message : undefined,
    'details' in error ? error.details : undefined
  ]
    .filter(Boolean)
    .join('\n')
}

function isImageNotLoadedText(text: string): boolean {
  return /invalid image file|\[errno 21\].*is a directory/i.test(text)
}

function isImageNotLoadedValidationError(error: NodeValidationError): boolean {
  return (
    error.type === 'custom_validation_failed' &&
    isImageNotLoadedText(getErrorText(error))
  )
}

function nodeInputItemLabel(nodeName: string, inputName: string): string {
  return `${nodeName} - ${inputName}`
}

const VALIDATION_ERROR_RULES: Record<string, ValidationCatalogRule> = {
  [REQUIRED_INPUT_MISSING_TYPE]: {
    catalogId: REQUIRED_INPUT_MISSING_CATALOG_ID,
    key: REQUIRED_INPUT_MISSING_TYPE,
    itemLabel: 'nodeInput'
  },
  bad_linked_input: {
    catalogId: 'bad_linked_input',
    key: 'bad_linked_input',
    itemLabel: 'nodeInput'
  },
  return_type_mismatch: {
    catalogId: 'return_type_mismatch',
    key: 'return_type_mismatch',
    itemLabel: 'nodeInput'
  },
  invalid_input_type: {
    catalogId: 'invalid_input_type',
    key: 'invalid_input_type',
    itemLabel: 'nodeInput'
  },
  value_smaller_than_min: {
    catalogId: 'value_smaller_than_min',
    key: 'value_smaller_than_min',
    itemLabel: 'nodeInput'
  },
  value_bigger_than_max: {
    catalogId: 'value_bigger_than_max',
    key: 'value_bigger_than_max',
    itemLabel: 'nodeInput'
  },
  value_not_in_list: {
    catalogId: 'value_not_in_list',
    key: 'value_not_in_list',
    itemLabel: 'nodeInput'
  },
  custom_validation_failed: {
    catalogId: 'custom_validation_failed',
    key: 'custom_validation_failed',
    itemLabel: 'nodeInput'
  },
  exception_during_inner_validation: {
    catalogId: 'exception_during_inner_validation',
    key: 'exception_during_inner_validation',
    itemLabel: 'nodeInput'
  },
  exception_during_validation: {
    catalogId: 'exception_during_validation',
    key: 'exception_during_validation',
    itemLabel: 'node'
  },
  dependency_cycle: {
    catalogId: 'dependency_cycle',
    key: 'dependency_cycle',
    itemLabel: 'node'
  }
}

const IMAGE_NOT_LOADED_VALIDATION_RULE = {
  catalogId: IMAGE_NOT_LOADED_CATALOG_ID,
  key: 'image_not_loaded',
  itemLabel: 'node'
} satisfies ValidationCatalogRule

function resolveValidationCatalogCopy(
  error: NodeValidationError,
  context: ErrorResolveContext,
  rule: ValidationCatalogRule
): ResolvedErrorMessage {
  const nodeName = normalizeNodeName(context.nodeDisplayName)
  const inputName = getInputName(error)
  const params = { nodeName, inputName }
  const keyPrefix = `errorCatalog.validationErrors.${rule.key}`
  const titleFallback = error.type || error.message
  const itemLabelFallback =
    rule.itemLabel === 'node'
      ? nodeName
      : nodeInputItemLabel(nodeName, inputName)

  return {
    catalogId: rule.catalogId,
    displayTitle: translateCatalogMessage(
      `${keyPrefix}.title`,
      titleFallback,
      params
    ),
    displayMessage: translateCatalogMessage(
      `${keyPrefix}.message`,
      error.message,
      params
    ),
    displayDetails: translateOptionalCatalogMessage(
      `${keyPrefix}.details`,
      error.details,
      params
    ),
    displayItemLabel: translateCatalogMessage(
      `${keyPrefix}.itemLabel`,
      itemLabelFallback,
      params
    ),
    toastTitle: translateCatalogMessage(
      `${keyPrefix}.toastTitle`,
      titleFallback,
      params
    ),
    toastMessage: translateCatalogMessage(
      `${keyPrefix}.toastMessage`,
      error.message,
      params
    )
  }
}

function resolveNodeValidationErrorMessage(
  error: NodeValidationError,
  context: ErrorResolveContext
): ResolvedErrorMessage {
  if (isImageNotLoadedValidationError(error)) {
    return resolveValidationCatalogCopy(
      error,
      context,
      IMAGE_NOT_LOADED_VALIDATION_RULE
    )
  }

  const rule = VALIDATION_ERROR_RULES[error.type]
  if (!rule) return {}

  return resolveValidationCatalogCopy(error, context, rule)
}

function resolveExecutionErrorMessage(): ResolvedErrorMessage {
  // Runtime catalog copy is deferred so actionable service errors stay raw.
  return {}
}

function resolvePromptErrorMessage(
  error: Extract<RunErrorMessageSource, { kind: 'prompt' }>['error'],
  context: ErrorResolveContext
): ResolvedErrorMessage {
  if (error.type === 'ImageDownloadError') {
    return {
      catalogId: IMAGE_NOT_LOADED_CATALOG_ID,
      displayTitle: st(
        'errorCatalog.promptErrors.image_not_loaded.title',
        error.type || error.message
      ),
      displayMessage: st(
        'errorCatalog.promptErrors.image_not_loaded.desc',
        error.message
      )
    }
  }

  if (error.type === 'OOMError') {
    const messageKey = context.isCloud
      ? 'errorCatalog.promptErrors.out_of_memory.descCloud'
      : 'errorCatalog.promptErrors.out_of_memory.descLocal'

    return {
      catalogId: OUT_OF_MEMORY_CATALOG_ID,
      displayTitle: st(
        'errorCatalog.promptErrors.out_of_memory.title',
        error.type || error.message
      ),
      displayMessage: st(messageKey, error.message)
    }
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
      error.type || error.message
    ),
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
      return resolveExecutionErrorMessage()
    case 'prompt':
      return resolvePromptErrorMessage(source.error, {
        isCloud: source.isCloud
      })
  }
}
