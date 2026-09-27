import {
  ACCESS_REQUIRED_CATALOG_ID,
  CONTENT_BLOCKED_CATALOG_ID,
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
import type { CatalogParams } from './catalogI18n'

// Runtime errors can share generic exception labels, so targeted cataloging
// relies on narrow stable messages. Keep these matches exact or prefix-based.
const INSUFFICIENT_CREDITS_MESSAGES = new Set([
  'Payment Required: Please add credits to your account to use this node.'
])
const WORKSPACE_INSUFFICIENT_CREDITS_MESSAGES = new Set([
  // Execution-time (pre-GPU) WebSocket failure for a queued team job.
  'Payment Required: Please add credits to your workspace to continue.',
  // Submit-time 429 rejection for a team workspace out of credits
  // (checkTeamWorkspaceSubscription). It shares the PAYMENT_REQUIRED error type
  // with the subscription-required rejection, so it can only be told apart by
  // message.
  'Insufficient credits to queue workflows'
])
const SUBSCRIPTION_REQUIRED_MESSAGES = new Set([
  'Workspace has no active subscription. Please subscribe to a plan to continue.',
  'User has no active subscription. Please subscribe to a plan to continue.',
  'Subscription required to queue workflows'
])
const SUBSCRIPTION_UPGRADE_REQUIRED_PREFIX =
  'the following private models require a subscription upgrade:'
const TIMEOUT_MESSAGES = new Set(['Job execution time exceeded maximum limit'])
const GENERATION_STALLED_MESSAGES = new Set([
  'Job went too long without making any progress',
  'Job has stagnated'
])
const SERVER_CRASHED_MESSAGES = new Set([
  'RIP to the server your workflow was running on.',
  'Inference service restarted, terminating job',
  'Job stuck in erroring state, forcing terminal transition',
  'Job was previously marked as lost and has now been acknowledged by inference service'
])
const SERVER_BUSY_MESSAGES = new Set([
  'Failed to enqueue job for processing',
  'Executor is busy with another job',
  'Servers are busy. Please try again later.'
])
const INVALID_WORKFLOW_REQUEST_MESSAGES = new Set([
  'The workflow request is invalid.',
  'Invalid job: missing workflow',
  "Invalid workflow: missing 'prompt' field",
  "Invalid workflow: 'prompt' field must be an object"
])
const ACCESS_REQUIRED_MESSAGE =
  'This run requires access that is not available for the current account.'
const MODEL_ACCESS_ERROR_MESSAGE =
  'One or more required models could not be accessed.'
const UNEXPECTED_SERVICE_ERROR_MESSAGE = 'Unexpected service error.'
const REQUEST_FAILED_MESSAGE =
  'The request failed before the run could complete.'
const RUN_START_FAILED_MESSAGE = 'The run could not be started.'
const RUN_ENDED_UNEXPECTEDLY_MESSAGE = 'The run ended unexpectedly.'
const SIGN_IN_REQUIRED_MESSAGE =
  'Unauthorized: Please login first to use this node.'
const RATE_LIMITED_PREFIX = 'Rate Limit Exceeded:'
const CORE_OOM_TIP = 'This error means you ran out of memory on your GPU.'
const CORE_OOM_ALLOCATION_PREFIX = 'Allocation on device'
const CLOUD_OOM_PREFIX =
  'Workflow execution failed due to insufficient memory (OOM).'
const ERRNO_DIRECTORY_MESSAGE = '[Errno 21] Is a directory:'
const INVALID_CLIP_INPUT_PREFIX = 'ERROR: clip input is invalid: None'
const PROMPT_TOO_SHORT_MESSAGE =
  "Field 'prompt' cannot be shorter than 1 characters; was 0 characters long."
const PROMPT_EMPTY_MESSAGE = "Field 'prompt' cannot be empty."
const PREPROCESSING_FAILED_MESSAGE = 'Preprocessing failed'
const PREPROCESSING_TIMEOUT_MESSAGES = new Set([
  'Preprocessing timed out',
  'Preprocessing timed out.'
])
const MODEL_DOWNLOAD_PANIC_PREFIX = 'internal error during model download:'
const GENERATED_VIDEO_REJECTED_MESSAGE =
  'Generated video rejected by content moderation.'
const GENERATED_CONTENT_REJECTED_MESSAGE =
  'Generated content was rejected by a safety check.'
const SAFETY_CHECK_MESSAGE = 'Prompt or Initial Image failed the safety checks.'
const CONTENT_POLICY_VIOLATION_MESSAGE =
  'The generated image was flagged for content policy violation.'
const CONTENT_MODERATION_FLAGGED_PREFIX =
  'Your request was flagged by our content moderation system'
const GOOGLE_RAI_FILTERED_PREFIX =
  "Content filtered by Google's Responsible AI practices"
const GOOGLE_RAI_BLOCKED_PREFIX =
  "Content blocked by Google's Responsible AI filters"

const START_FAILED_PREFIXES = [
  'Failed to start WebSocket client:',
  'Failed to get ComfyUI generation ID:'
]
const REQUEST_FAILED_PREFIXES = ['Failed to send prompt request:']
const SERVER_CRASHED_PREFIXES = [
  'Workflow execution was interrupted due to ComfyUI process restart.',
  'Job execution interrupted: server shutdown.',
  'Failed to clear queue and restart failed:',
  'WebSocket failed to reconnect after restart:'
]
const PREPROCESSING_FAILED_PREFIXES = [
  'Preprocessing failed:',
  'Failed to complete preparation:'
]

export interface RuntimeErrorInfo {
  exceptionType: string
  exceptionMessage: string
}

interface RuntimeCatalogMatch {
  catalogId: string
  params?: CatalogParams
  detailsFallback?: string
}

interface RuntimeMatchRule {
  matches: (info: RuntimeErrorInfo, message: string) => boolean
  resolve: (info: RuntimeErrorInfo, message: string) => RuntimeCatalogMatch
}

function catalogMatch(
  catalogId: string,
  options: Omit<RuntimeCatalogMatch, 'catalogId'> = {}
): RuntimeCatalogMatch {
  return { catalogId, ...options }
}

function catalogMatchWithMessageFallback(
  catalogId: string,
  message: string
): RuntimeCatalogMatch {
  return catalogMatch(catalogId, { detailsFallback: message })
}

function isOutOfMemoryError(info: RuntimeErrorInfo): boolean {
  const message = info.exceptionMessage
  return (
    info.exceptionType === 'OOMError' ||
    message.includes(CORE_OOM_TIP) ||
    message.includes(CORE_OOM_ALLOCATION_PREFIX) ||
    message.includes(CLOUD_OOM_PREFIX) ||
    message.includes('CUDA out of memory') ||
    message.includes('GPU out of memory')
  )
}

function isImageNotLoadedError(
  info: RuntimeErrorInfo,
  message: string
): boolean {
  return (
    info.exceptionType === 'ImageDownloadError' ||
    (info.exceptionType === 'IsADirectoryError' &&
      message.includes(ERRNO_DIRECTORY_MESSAGE))
  )
}

function getSubscriptionUpgradeDetails(message: string): string {
  return message.slice(SUBSCRIPTION_UPGRADE_REQUIRED_PREFIX.length).trim()
}

function isContentBlockedError(message: string): boolean {
  return (
    message.includes(GENERATED_VIDEO_REJECTED_MESSAGE) ||
    message.includes(GENERATED_CONTENT_REJECTED_MESSAGE) ||
    message.includes(SAFETY_CHECK_MESSAGE) ||
    message.includes(CONTENT_POLICY_VIOLATION_MESSAGE) ||
    message.startsWith(CONTENT_MODERATION_FLAGGED_PREFIX) ||
    message.startsWith(GOOGLE_RAI_FILTERED_PREFIX) ||
    message.startsWith(GOOGLE_RAI_BLOCKED_PREFIX)
  )
}

function startsWithAny(message: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => message.startsWith(prefix))
}

function hasEmbeddedApiErrorPayload(message: string): boolean {
  // Embedded validation responses are parsed by a more specific path, so do not
  // catalog them as a generic request failure here.
  return /request returned error status \d{3}:\s*\{/.test(message)
}

function isSubscriptionUpgradeMessage(message: string): boolean {
  return (
    message.toLowerCase().startsWith(SUBSCRIPTION_UPGRADE_REQUIRED_PREFIX) &&
    getSubscriptionUpgradeDetails(message).length > 0
  )
}

// Order matters: the first matching rule wins. Keep narrow user-actionable
// signatures before broader fallbacks.
const RUNTIME_MATCH_RULES: RuntimeMatchRule[] = [
  {
    matches: isImageNotLoadedError,
    resolve: (_info, message) =>
      catalogMatchWithMessageFallback(IMAGE_NOT_LOADED_CATALOG_ID, message)
  },
  {
    matches: isOutOfMemoryError,
    resolve: (_info, message) =>
      catalogMatchWithMessageFallback(OUT_OF_MEMORY_CATALOG_ID, message)
  },
  {
    matches: (_info, message) => message.startsWith(INVALID_CLIP_INPUT_PREFIX),
    resolve: (_info, message) =>
      catalogMatchWithMessageFallback(INVALID_CLIP_INPUT_CATALOG_ID, message)
  },
  {
    matches: (_info, message) =>
      message.includes(PROMPT_TOO_SHORT_MESSAGE) ||
      message.includes(PROMPT_EMPTY_MESSAGE),
    resolve: () => catalogMatch(INVALID_PROMPT_CATALOG_ID)
  },
  {
    matches: (info, message) =>
      info.exceptionType === 'ValidationError' &&
      INVALID_WORKFLOW_REQUEST_MESSAGES.has(message),
    resolve: () => catalogMatch(INVALID_WORKFLOW_REQUEST_CATALOG_ID)
  },
  {
    matches: (_info, message) =>
      WORKSPACE_INSUFFICIENT_CREDITS_MESSAGES.has(message),
    resolve: () => catalogMatch(WORKSPACE_INSUFFICIENT_CREDITS_CATALOG_ID)
  },
  {
    // 'insufficient_credits' is the error.type BE-2866 will emit on the
    // personal submit-time 402; the team submit path is a 429 matched by
    // message in WORKSPACE_INSUFFICIENT_CREDITS_MESSAGES above.
    matches: (info, message) =>
      info.exceptionType === 'InsufficientFundsError' ||
      info.exceptionType === 'insufficient_credits' ||
      INSUFFICIENT_CREDITS_MESSAGES.has(message),
    resolve: () => catalogMatch(INSUFFICIENT_CREDITS_CATALOG_ID)
  },
  {
    matches: (info, message) =>
      info.exceptionType === 'InactiveSubscriptionError' ||
      SUBSCRIPTION_REQUIRED_MESSAGES.has(message),
    resolve: () => catalogMatch(SUBSCRIPTION_REQUIRED_CATALOG_ID)
  },
  {
    matches: (_info, message) => isSubscriptionUpgradeMessage(message),
    resolve: (_info, message) => {
      const modelNames = getSubscriptionUpgradeDetails(message)
      return catalogMatch(SUBSCRIPTION_UPGRADE_REQUIRED_CATALOG_ID, {
        params: { modelNames },
        detailsFallback: message
      })
    }
  },
  {
    matches: (info, message) =>
      info.exceptionType === 'AccessRequired' ||
      message === ACCESS_REQUIRED_MESSAGE,
    resolve: () => catalogMatch(ACCESS_REQUIRED_CATALOG_ID)
  },
  {
    matches: (info, message) =>
      info.exceptionType === 'ModelAccessError' ||
      message === MODEL_ACCESS_ERROR_MESSAGE,
    resolve: () => catalogMatch(MODEL_ACCESS_ERROR_CATALOG_ID)
  },
  {
    matches: (_info, message) => message.includes(SIGN_IN_REQUIRED_MESSAGE),
    resolve: () => catalogMatch(SIGN_IN_REQUIRED_CATALOG_ID)
  },
  {
    matches: (_info, message) => message.startsWith(RATE_LIMITED_PREFIX),
    resolve: (_info, message) =>
      catalogMatchWithMessageFallback(RATE_LIMITED_CATALOG_ID, message)
  },
  {
    matches: (info, message) =>
      info.exceptionType === 'PreprocessingTimeout' ||
      PREPROCESSING_TIMEOUT_MESSAGES.has(message),
    resolve: () => catalogMatch(PREPROCESSING_TIMEOUT_CATALOG_ID)
  },
  {
    matches: (_info, message) =>
      message === PREPROCESSING_FAILED_MESSAGE ||
      startsWithAny(message, PREPROCESSING_FAILED_PREFIXES),
    resolve: (_info, message) =>
      message === PREPROCESSING_FAILED_MESSAGE
        ? catalogMatch(PREPROCESSING_FAILED_CATALOG_ID)
        : catalogMatchWithMessageFallback(
            PREPROCESSING_FAILED_CATALOG_ID,
            message
          )
  },
  {
    matches: (info, message) =>
      info.exceptionType === 'PanicError' &&
      message.startsWith(MODEL_DOWNLOAD_PANIC_PREFIX),
    resolve: (_info, message) =>
      catalogMatchWithMessageFallback(MODEL_DOWNLOAD_FAILED_CATALOG_ID, message)
  },
  {
    matches: (_info, message) => isContentBlockedError(message),
    resolve: (_info, message) =>
      catalogMatchWithMessageFallback(CONTENT_BLOCKED_CATALOG_ID, message)
  },
  {
    matches: (_info, message) => startsWithAny(message, START_FAILED_PREFIXES),
    resolve: (_info, message) =>
      catalogMatchWithMessageFallback(RUN_START_FAILED_CATALOG_ID, message)
  },
  {
    matches: (_info, message) =>
      startsWithAny(message, REQUEST_FAILED_PREFIXES) &&
      !hasEmbeddedApiErrorPayload(message),
    resolve: (_info, message) =>
      catalogMatchWithMessageFallback(REQUEST_FAILED_CATALOG_ID, message)
  },
  {
    matches: (_info, message) => message === RUN_START_FAILED_MESSAGE,
    resolve: () => catalogMatch(RUN_START_FAILED_CATALOG_ID)
  },
  {
    matches: (_info, message) => message === RUN_ENDED_UNEXPECTEDLY_MESSAGE,
    resolve: () => catalogMatch(RUN_ENDED_UNEXPECTEDLY_CATALOG_ID)
  },
  {
    matches: (info, message) =>
      info.exceptionType === 'PanicError' &&
      message.startsWith('panic during job execution:'),
    resolve: (_info, message) =>
      catalogMatchWithMessageFallback(
        RUN_ENDED_UNEXPECTEDLY_CATALOG_ID,
        message
      )
  },
  {
    matches: (_info, message) => TIMEOUT_MESSAGES.has(message),
    resolve: () => catalogMatch(TIMEOUT_CATALOG_ID)
  },
  {
    matches: (_info, message) => GENERATION_STALLED_MESSAGES.has(message),
    resolve: () => catalogMatch(GENERATION_STALLED_CATALOG_ID)
  },
  {
    matches: (_info, message) => SERVER_CRASHED_MESSAGES.has(message),
    resolve: () => catalogMatch(SERVER_CRASHED_CATALOG_ID)
  },
  {
    matches: (_info, message) =>
      startsWithAny(message, SERVER_CRASHED_PREFIXES),
    resolve: (_info, message) =>
      catalogMatchWithMessageFallback(SERVER_CRASHED_CATALOG_ID, message)
  },
  {
    matches: (_info, message) => SERVER_BUSY_MESSAGES.has(message),
    resolve: () => catalogMatch(SERVER_BUSY_CATALOG_ID)
  },
  {
    matches: (info, message) =>
      info.exceptionType === 'UnexpectedServiceError' ||
      message === UNEXPECTED_SERVICE_ERROR_MESSAGE,
    resolve: () => catalogMatch(UNEXPECTED_SERVICE_ERROR_CATALOG_ID)
  },
  {
    matches: (info, message) =>
      message === REQUEST_FAILED_MESSAGE ||
      (info.exceptionType === 'RequestError' &&
        !hasEmbeddedApiErrorPayload(message)),
    resolve: (_info, message) =>
      message === REQUEST_FAILED_MESSAGE
        ? catalogMatch(REQUEST_FAILED_CATALOG_ID)
        : catalogMatchWithMessageFallback(REQUEST_FAILED_CATALOG_ID, message)
  }
]

export function resolveRuntimeCatalogMatch(
  info: RuntimeErrorInfo
): RuntimeCatalogMatch | undefined {
  const message = info.exceptionMessage.trim()

  for (const rule of RUNTIME_MATCH_RULES) {
    if (rule.matches(info, message)) return rule.resolve(info, message)
  }

  return undefined
}
