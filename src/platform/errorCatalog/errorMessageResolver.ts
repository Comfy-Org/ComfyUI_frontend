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
const IMAGE_NOT_LOADED_CATALOG_ID = 'image_not_loaded'
const OUT_OF_MEMORY_CATALOG_ID = 'out_of_memory'
const KNOWN_PROMPT_ERROR_TYPES = new Set([
  'prompt_no_outputs',
  'no_prompt',
  'server_error',
  'missing_node_type',
  'prompt_outputs_failed_validation'
])

interface CatalogCopyFallbacks {
  catalogId: string
  title: string
  message: string
  details?: string
  itemLabel?: string
  toastTitle?: string
  toastMessage?: string
}

interface RuntimeCopyFallbacks {
  catalogId: string
  title: string
  messageLocal?: string
  messageCloud?: string
  message?: string
  itemLabel?: string
  toastTitle?: string
  toastMessageLocal?: string
  toastMessageCloud?: string
  toastMessage?: string
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

function getErrorText(
  error: NodeValidationError | RunErrorMessageSource['error']
) {
  return [
    'message' in error ? error.message : undefined,
    'details' in error ? error.details : undefined,
    'exception_message' in error ? error.exception_message : undefined,
    'exception_type' in error ? error.exception_type : undefined
  ]
    .filter(Boolean)
    .join('\n')
}

function isImageNotLoadedText(text: string): boolean {
  return /invalid image file|\[errno 21\].*is a directory/i.test(text)
}

function isOutOfMemoryText(text: string): boolean {
  return /outofmemoryerror|out of memory|allocation on device|insufficient memory \(oom\)/i.test(
    text
  )
}

function isImageNotLoadedValidationError(error: NodeValidationError): boolean {
  return (
    error.type === 'custom_validation_failed' &&
    isImageNotLoadedText(getErrorText(error))
  )
}

function resolveCatalogCopy(
  keyPrefix: string,
  fallback: CatalogCopyFallbacks,
  params?: Record<string, string | number>
): ResolvedErrorMessage {
  return {
    catalogId: fallback.catalogId,
    displayTitle: translateCatalogMessage(
      `${keyPrefix}.title`,
      fallback.title,
      params
    ),
    displayMessage: translateCatalogMessage(
      `${keyPrefix}.message`,
      fallback.message,
      params
    ),
    ...(fallback.details
      ? {
          displayDetails: translateCatalogMessage(
            `${keyPrefix}.details`,
            fallback.details,
            params
          )
        }
      : {}),
    ...(fallback.itemLabel
      ? {
          displayItemLabel: translateCatalogMessage(
            `${keyPrefix}.itemLabel`,
            fallback.itemLabel,
            params
          )
        }
      : {}),
    ...(fallback.toastTitle
      ? {
          toastTitle: translateCatalogMessage(
            `${keyPrefix}.toastTitle`,
            fallback.toastTitle,
            params
          )
        }
      : {}),
    ...(fallback.toastMessage
      ? {
          toastMessage: translateCatalogMessage(
            `${keyPrefix}.toastMessage`,
            fallback.toastMessage,
            params
          )
        }
      : {})
  }
}

function resolveRuntimeCatalogCopy(
  keyPrefix: string,
  fallback: RuntimeCopyFallbacks,
  params: Record<string, string | number>,
  isCloud?: boolean
): ResolvedErrorMessage {
  const messageKey = isCloud ? 'messageCloud' : 'messageLocal'
  const toastMessageKey = isCloud ? 'toastMessageCloud' : 'toastMessageLocal'
  const messageFallback =
    (isCloud ? fallback.messageCloud : fallback.messageLocal) ??
    fallback.message ??
    ''
  const toastMessageFallback =
    (isCloud ? fallback.toastMessageCloud : fallback.toastMessageLocal) ??
    fallback.toastMessage

  return {
    catalogId: fallback.catalogId,
    displayTitle: translateCatalogMessage(
      `${keyPrefix}.title`,
      fallback.title,
      params
    ),
    ...(messageFallback
      ? {
          displayMessage: translateCatalogMessage(
            `${keyPrefix}.${fallback.message ? 'message' : messageKey}`,
            messageFallback,
            params
          )
        }
      : {}),
    ...(fallback.itemLabel
      ? {
          displayItemLabel: translateCatalogMessage(
            `${keyPrefix}.itemLabel`,
            fallback.itemLabel,
            params
          )
        }
      : {}),
    ...(fallback.toastTitle
      ? {
          toastTitle: translateCatalogMessage(
            `${keyPrefix}.toastTitle`,
            fallback.toastTitle,
            params
          )
        }
      : {}),
    ...(toastMessageFallback
      ? {
          toastMessage: translateCatalogMessage(
            `${keyPrefix}.${fallback.toastMessage ? 'toastMessage' : toastMessageKey}`,
            toastMessageFallback,
            params
          )
        }
      : {})
  }
}

const VALIDATION_ERROR_COPY: Record<string, CatalogCopyFallbacks> = {
  [REQUIRED_INPUT_MISSING_TYPE]: {
    catalogId: REQUIRED_INPUT_MISSING_CATALOG_ID,
    title: 'Missing connection',
    message: 'Required input slots have no connection feeding them.',
    details: '{nodeName} is missing a required input: {inputName}',
    itemLabel: '{nodeName} - {inputName}',
    toastTitle: 'Required input missing',
    toastMessage: '{nodeName} is missing a required input: {inputName}'
  },
  bad_linked_input: {
    catalogId: 'bad_linked_input',
    title: 'Invalid connection',
    message: 'A linked input connection is malformed.',
    details: '{nodeName} has an invalid connection for {inputName}.',
    itemLabel: '{nodeName} - {inputName}',
    toastTitle: 'Invalid connection',
    toastMessage: '{nodeName} has an invalid connection for {inputName}.'
  },
  return_type_mismatch: {
    catalogId: 'return_type_mismatch',
    title: 'Invalid connection',
    message: 'Connected nodes are using incompatible input and output types.',
    details: '{nodeName} has an incompatible connection for {inputName}.',
    itemLabel: '{nodeName} - {inputName}',
    toastTitle: 'Invalid connection',
    toastMessage: '{nodeName} has an incompatible connection for {inputName}.'
  },
  invalid_input_type: {
    catalogId: 'invalid_input_type',
    title: 'Invalid input',
    message: 'An input value has the wrong type.',
    details: "{nodeName} couldn't convert {inputName} to the expected type.",
    itemLabel: '{nodeName} - {inputName}',
    toastTitle: 'Invalid input',
    toastMessage:
      "{nodeName} couldn't convert {inputName} to the expected type."
  },
  value_smaller_than_min: {
    catalogId: 'value_smaller_than_min',
    title: 'Input out of range',
    message: 'Some input values are outside the allowed range.',
    details: '{nodeName} has a value below the minimum for {inputName}.',
    itemLabel: '{nodeName} - {inputName}',
    toastTitle: 'Input out of range',
    toastMessage: '{nodeName} has a value below the minimum for {inputName}.'
  },
  value_bigger_than_max: {
    catalogId: 'value_bigger_than_max',
    title: 'Input out of range',
    message: 'Some input values are outside the allowed range.',
    details: '{nodeName} has a value above the maximum for {inputName}.',
    itemLabel: '{nodeName} - {inputName}',
    toastTitle: 'Input out of range',
    toastMessage: '{nodeName} has a value above the maximum for {inputName}.'
  },
  value_not_in_list: {
    catalogId: 'value_not_in_list',
    title: 'Invalid input',
    message: 'Some input values are not available for this node.',
    details: '{nodeName} has an unsupported value for {inputName}.',
    itemLabel: '{nodeName} - {inputName}',
    toastTitle: 'Invalid input',
    toastMessage: '{nodeName} has an unsupported value for {inputName}.'
  },
  custom_validation_failed: {
    catalogId: 'custom_validation_failed',
    title: 'Invalid input',
    message: 'A node rejected one or more input values.',
    details: '{nodeName} rejected the value for {inputName}.',
    itemLabel: '{nodeName} - {inputName}',
    toastTitle: 'Invalid input',
    toastMessage: '{nodeName} rejected the value for {inputName}.'
  },
  exception_during_inner_validation: {
    catalogId: 'exception_during_inner_validation',
    title: 'Validation failed',
    message: "The workflow couldn't validate a connected node.",
    details: "{nodeName} couldn't validate {inputName}.",
    itemLabel: '{nodeName} - {inputName}',
    toastTitle: 'Validation failed',
    toastMessage: "{nodeName} couldn't validate {inputName}."
  },
  exception_during_validation: {
    catalogId: 'exception_during_validation',
    title: 'Validation failed',
    message: 'The node could not be validated.',
    details: '{nodeName} could not be validated.',
    itemLabel: '{nodeName}',
    toastTitle: 'Validation failed',
    toastMessage: '{nodeName} could not be validated.'
  },
  dependency_cycle: {
    catalogId: 'dependency_cycle',
    title: 'Invalid workflow',
    message: 'The workflow has a circular node connection.',
    details: '{nodeName} is part of a circular connection.',
    itemLabel: '{nodeName}',
    toastTitle: 'Invalid workflow',
    toastMessage: '{nodeName} is part of a circular connection.'
  }
}

const IMAGE_NOT_LOADED_VALIDATION_COPY = {
  catalogId: IMAGE_NOT_LOADED_CATALOG_ID,
  title: 'Image not loaded',
  message: "The system couldn't load this image.",
  details: "The image for {nodeName} couldn't be loaded. Try adding it again.",
  itemLabel: '{nodeName}',
  toastTitle: "Input image couldn't be loaded",
  toastMessage:
    "The image for {nodeName} couldn't be loaded. Try adding it again."
} satisfies CatalogCopyFallbacks

const RUNTIME_ERROR_COPY = {
  execution_failed: {
    catalogId: EXECUTION_FAILED_CATALOG_ID,
    title: 'Execution failed',
    messageLocal: 'Node threw an error during execution.',
    messageCloud: 'Node threw an error during execution. No credits charged.',
    itemLabel: '{nodeName}',
    toastTitle: '{nodeName} failed',
    toastMessageLocal:
      'This node threw an error during execution. Check its inputs or try a different configuration.',
    toastMessageCloud:
      'This node threw an error during execution. Check its inputs or try a different configuration. No credits charged.'
  },
  image_not_loaded: {
    catalogId: IMAGE_NOT_LOADED_CATALOG_ID,
    title: 'Image not loaded',
    message: "The system couldn't load this image.",
    itemLabel: '{nodeName}',
    toastTitle: "Input image couldn't be loaded",
    toastMessage:
      "The image for {nodeName} couldn't be loaded. Try adding it again."
  },
  out_of_memory: {
    catalogId: OUT_OF_MEMORY_CATALOG_ID,
    title: 'Generation failed',
    messageLocal:
      'Not enough GPU memory. Try reducing complexity and run again.',
    messageCloud:
      'Not enough GPU memory. Try reducing complexity and run again. No credits charged.',
    itemLabel: '{nodeName}',
    toastTitle: 'Generation failed',
    toastMessageLocal:
      'Not enough GPU memory. Try reducing complexity and run again.',
    toastMessageCloud:
      'Not enough GPU memory. Try reducing complexity and run again. No credits charged.'
  }
} satisfies Record<string, RuntimeCopyFallbacks>

function resolveValidationCatalogCopy(
  error: NodeValidationError,
  context: ErrorResolveContext,
  errorTypeKey: string,
  fallback: CatalogCopyFallbacks
): ResolvedErrorMessage {
  const nodeName = normalizeNodeName(context.nodeDisplayName)
  const inputName = getInputName(error)
  return resolveCatalogCopy(
    `errorCatalog.validationErrors.${errorTypeKey}`,
    fallback,
    { nodeName, inputName }
  )
}

function resolveNodeValidationErrorMessage(
  error: NodeValidationError,
  context: ErrorResolveContext
): ResolvedErrorMessage {
  if (isImageNotLoadedValidationError(error)) {
    return resolveValidationCatalogCopy(
      error,
      context,
      'image_not_loaded',
      IMAGE_NOT_LOADED_VALIDATION_COPY
    )
  }

  const fallback = VALIDATION_ERROR_COPY[error.type]
  if (!fallback) return {}

  return resolveValidationCatalogCopy(error, context, error.type, fallback)
}

function resolveExecutionErrorMessage(
  error: Extract<RunErrorMessageSource, { kind: 'execution' }>['error'],
  context: ErrorResolveContext
): ResolvedErrorMessage {
  const nodeName = normalizeNodeName(context.nodeDisplayName)
  const params = { nodeName }
  const errorText = getErrorText(error)

  if (
    error.exception_type === 'ImageDownloadError' ||
    isImageNotLoadedText(errorText)
  ) {
    return resolveRuntimeCatalogCopy(
      'errorCatalog.runtimeErrors.image_not_loaded',
      RUNTIME_ERROR_COPY.image_not_loaded,
      params,
      context.isCloud
    )
  }

  if (error.exception_type === 'OOMError' || isOutOfMemoryText(errorText)) {
    return resolveRuntimeCatalogCopy(
      'errorCatalog.runtimeErrors.out_of_memory',
      RUNTIME_ERROR_COPY.out_of_memory,
      params,
      context.isCloud
    )
  }

  return resolveRuntimeCatalogCopy(
    'errorCatalog.runtimeErrors.execution_failed',
    RUNTIME_ERROR_COPY.execution_failed,
    params,
    context.isCloud
  )
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
        'Image not loaded'
      ),
      displayMessage: st(
        'errorCatalog.promptErrors.image_not_loaded.desc',
        "The system couldn't load this image."
      )
    }
  }

  if (error.type === 'OOMError') {
    const messageKey = context.isCloud
      ? 'errorCatalog.promptErrors.out_of_memory.descCloud'
      : 'errorCatalog.promptErrors.out_of_memory.descLocal'
    const messageFallback = context.isCloud
      ? 'Not enough GPU memory. Try reducing complexity and run again. No credits charged.'
      : 'Not enough GPU memory. Try reducing complexity and run again.'

    return {
      catalogId: OUT_OF_MEMORY_CATALOG_ID,
      displayTitle: st(
        'errorCatalog.promptErrors.out_of_memory.title',
        'Generation failed'
      ),
      displayMessage: st(messageKey, messageFallback)
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
    ...(te(`errorCatalog.promptErrors.${errorTypeKey}.title`)
      ? {
          displayTitle: t(`errorCatalog.promptErrors.${errorTypeKey}.title`)
        }
      : {}),
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
      return resolveExecutionErrorMessage(source.error, {
        isCloud: source.isCloud,
        nodeDisplayName: source.nodeDisplayName
      })
    case 'prompt':
      return resolvePromptErrorMessage(source.error, {
        isCloud: source.isCloud
      })
  }
}
