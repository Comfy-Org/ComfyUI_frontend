import type { NodeValidationError, ResolvedCatalogErrorMessage } from './types'

import {
  IMAGE_NOT_LOADED_CATALOG_ID,
  MISSING_CONNECTION_CATALOG_ID,
  UNKNOWN_VALIDATION_ERROR_CATALOG_ID
} from './catalogIds'
import {
  normalizeNodeName,
  translateCatalogMessage,
  translateOptionalCatalogMessage
} from './catalogI18n'
import type { CatalogParams, ErrorResolveContext } from './catalogI18n'
import {
  INPUT_LEVEL_VALIDATION_ERROR_TYPES,
  NODE_LEVEL_VALIDATION_ERROR_TYPES,
  getInputConfigBounds,
  isImageNotLoadedValidationError
} from '@/utils/executionErrorUtil'

const REQUIRED_INPUT_MISSING_TYPE = 'required_input_missing'
export const WORKSPACE_PARTNER_NODE_DISABLED_TYPE =
  'workspace_partner_node_disabled'

// Resolves node validation errors. Most validation types map 1:1 to their
// catalog/locale keys; FE-specific recategorization uses a separate catalogId,
// such as required_input_missing -> missing_connection.
interface ValidationCatalogRule {
  catalogId: string
  itemLabel: 'node' | 'nodeInput'
  copyKeys?: CopyKeys
}

interface CopyKeys {
  detailsKey: string
  toastMessageKey: string
}

const DEFAULT_COPY_KEYS: CopyKeys = {
  detailsKey: 'details',
  toastMessageKey: 'toastMessage'
}

const VALUE_SPECIFIC_COPY_RULES: Record<
  string,
  {
    requiredParams: string[]
    suffix: 'WithTypes' | 'WithValue'
  }
> = {
  return_type_mismatch: {
    requiredParams: ['expectedType', 'receivedType'],
    suffix: 'WithTypes'
  },
  invalid_input_type: {
    requiredParams: ['receivedValue', 'expectedType'],
    suffix: 'WithValue'
  },
  value_smaller_than_min: {
    requiredParams: ['receivedValue', 'minValue'],
    suffix: 'WithValue'
  },
  value_bigger_than_max: {
    requiredParams: ['receivedValue', 'maxValue'],
    suffix: 'WithValue'
  },
  value_not_in_list: {
    requiredParams: ['receivedValue'],
    suffix: 'WithValue'
  }
}

const NODE_LEVEL_VALIDATION_ERROR_RULES: Record<string, ValidationCatalogRule> =
  Object.fromEntries(
    Array.from(NODE_LEVEL_VALIDATION_ERROR_TYPES, (type) => [
      type,
      { catalogId: type, itemLabel: 'node' } satisfies ValidationCatalogRule
    ])
  )

const INPUT_LEVEL_VALIDATION_ERROR_RULES: Record<
  string,
  ValidationCatalogRule
> = Object.fromEntries(
  Array.from(INPUT_LEVEL_VALIDATION_ERROR_TYPES, (type) => [
    type,
    { catalogId: type, itemLabel: 'nodeInput' } satisfies ValidationCatalogRule
  ])
)

const VALIDATION_ERROR_RULES: Record<string, ValidationCatalogRule> = {
  ...INPUT_LEVEL_VALIDATION_ERROR_RULES,
  [REQUIRED_INPUT_MISSING_TYPE]: {
    catalogId: MISSING_CONNECTION_CATALOG_ID,
    itemLabel: 'nodeInput'
  },
  [WORKSPACE_PARTNER_NODE_DISABLED_TYPE]: {
    catalogId: WORKSPACE_PARTNER_NODE_DISABLED_TYPE,
    itemLabel: 'node'
  },
  ...NODE_LEVEL_VALIDATION_ERROR_RULES
}

// Image-not-loaded shares the custom_validation_failed type, so type-keyed
// dispatch cannot distinguish it. The override also keeps it on default copy
// keys instead of custom_validation_failed's raw-details variant.
const IMAGE_NOT_LOADED_VALIDATION_RULE = {
  catalogId: IMAGE_NOT_LOADED_CATALOG_ID,
  itemLabel: 'node',
  copyKeys: DEFAULT_COPY_KEYS
} satisfies ValidationCatalogRule

const UNKNOWN_VALIDATION_ERROR_RULE = {
  catalogId: UNKNOWN_VALIDATION_ERROR_CATALOG_ID,
  itemLabel: 'node'
} satisfies ValidationCatalogRule

function getInputName(error: NodeValidationError): string {
  const inputName = error.extra_info?.input_name
  return (
    inputName?.trim() ||
    translateCatalogMessage('errorCatalog.fallbacks.inputName', 'unknown input')
  )
}

function nodeInputItemLabel(nodeName: string, inputName: string): string {
  return `${nodeName} - ${inputName}`
}

function formatDependencyCycleDetails(details: string): string {
  // Dependency cycle paths may be reported as "node -> node"; catalog copy
  // embeds those paths in prose, where "to" reads more naturally.
  return details.replace(/\s*->\s*/g, ' to ')
}

function formatCatalogValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return undefined
  }
}

function getInputConfigValue(
  error: NodeValidationError,
  key: 'min' | 'max'
): string | undefined {
  return formatCatalogValue(getInputConfigBounds(error)[key])
}

function getInputConfigType(error: NodeValidationError): string | undefined {
  const inputConfig = error.extra_info?.input_config
  if (!Array.isArray(inputConfig)) return undefined

  return formatCatalogValue(inputConfig[0])
}

function getValidationParams(
  error: NodeValidationError,
  nodeName: string,
  inputName: string
): CatalogParams {
  const params: CatalogParams = { nodeName, inputName }
  const receivedValue = formatCatalogValue(error.extra_info?.received_value)
  const receivedType = formatCatalogValue(error.extra_info?.received_type)
  const expectedType = getInputConfigType(error)
  const minValue = getInputConfigValue(error, 'min')
  const maxValue = getInputConfigValue(error, 'max')

  if (receivedValue !== undefined) params.receivedValue = receivedValue
  if (receivedType !== undefined) params.receivedType = receivedType
  if (expectedType !== undefined) params.expectedType = expectedType
  if (minValue !== undefined) params.minValue = minValue
  if (maxValue !== undefined) params.maxValue = maxValue

  return params
}

function hasParams(params: CatalogParams, keys: string[]): boolean {
  return keys.every((key) => params[key] !== undefined)
}

function getValueSpecificCopyKeys(
  errorType: string,
  params: CatalogParams
): CopyKeys {
  const rule = VALUE_SPECIFIC_COPY_RULES[errorType]
  if (!rule || !hasParams(params, rule.requiredParams)) return DEFAULT_COPY_KEYS

  return {
    detailsKey: `details${rule.suffix}`,
    toastMessageKey: `toastMessage${rule.suffix}`
  }
}

function getRawDetailsCopyKeys(error: NodeValidationError): CopyKeys {
  return error.details?.trim()
    ? {
        detailsKey: 'detailsWithRawDetails',
        toastMessageKey: 'toastMessageWithRawDetails'
      }
    : DEFAULT_COPY_KEYS
}

function getRawDetailsOnlyCopyKeys(error: NodeValidationError): CopyKeys {
  if (!error.details?.trim()) return DEFAULT_COPY_KEYS

  return {
    detailsKey: 'detailsWithRawDetails',
    toastMessageKey: 'toastMessage'
  }
}

function getValidationCopyKeys(
  error: NodeValidationError,
  params: CatalogParams
): CopyKeys {
  if (
    error.type === 'exception_during_validation' ||
    error.type === 'exception_during_inner_validation'
  ) {
    return getRawDetailsCopyKeys(error)
  }

  if (error.type === 'custom_validation_failed') {
    return getRawDetailsOnlyCopyKeys(error)
  }

  if (error.type === 'dependency_cycle') {
    return getRawDetailsOnlyCopyKeys(error)
  }

  return getValueSpecificCopyKeys(error.type, params)
}

function resolveValidationCatalogCopy(
  error: NodeValidationError,
  context: ErrorResolveContext,
  localeKey: string,
  rule: ValidationCatalogRule
): ResolvedCatalogErrorMessage {
  const nodeName = normalizeNodeName(context.nodeDisplayName)
  const inputName = getInputName(error)
  const trimmedDetails = error.details?.trim() ?? ''
  const rawDetails =
    error.type === 'dependency_cycle'
      ? formatDependencyCycleDetails(trimmedDetails)
      : trimmedDetails
  const params = {
    ...getValidationParams(error, nodeName, inputName),
    errorType: error.type || 'unknown',
    rawDetails
  }
  const keyPrefix = `errorCatalog.validationErrors.${localeKey}`
  const titleFallback = error.message || error.type
  const itemLabelFallback =
    rule.itemLabel === 'node'
      ? nodeName
      : nodeInputItemLabel(nodeName, inputName)
  const copyKeys = rule.copyKeys ?? getValidationCopyKeys(error, params)

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
      `${keyPrefix}.${copyKeys.detailsKey}`,
      error.details ?? '',
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
      `${keyPrefix}.${copyKeys.toastMessageKey}`,
      error.message,
      params
    )
  }
}

export function resolveNodeValidationErrorMessage(
  error: NodeValidationError,
  context: ErrorResolveContext
): ResolvedCatalogErrorMessage {
  if (isImageNotLoadedValidationError(error)) {
    return resolveValidationCatalogCopy(
      error,
      context,
      'image_not_loaded',
      IMAGE_NOT_LOADED_VALIDATION_RULE
    )
  }

  const rule = VALIDATION_ERROR_RULES[error.type]
  if (!rule) {
    return resolveValidationCatalogCopy(
      error,
      context,
      'unknown_validation_error',
      {
        ...UNKNOWN_VALIDATION_ERROR_RULE,
        copyKeys: getRawDetailsOnlyCopyKeys(error)
      }
    )
  }

  return resolveValidationCatalogCopy(error, context, error.type, rule)
}
