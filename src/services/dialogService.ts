import { zPromptErrorResponse } from '@comfyorg/ingest-types/zod'
import { isPlainObject } from 'es-toolkit'
import { merge } from 'es-toolkit/compat'
import type { Component } from 'vue'
import type { ComponentAttrs } from 'vue-component-type-helpers'

import { assert } from '@/base/assert'
import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import type { ConfirmationDialogType } from '@/components/dialog/content/confirmationDialogTypes'
import ErrorDialogContent from '@/components/dialog/content/ErrorDialogContent.vue'
import PromptDialogContent from '@/components/dialog/content/PromptDialogContent.vue'
import { HUG_CONTENT_CLASS } from '@/components/ui/dialog/dialog.variants'
import type {
  DowngradeToPersonalResult,
  SubscriptionDialogOptions,
  TopUpCreditsDialogOptions
} from '@/composables/billing/types'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import type { RunErrorMessageSource } from '@/platform/errorCatalog/types'
import type { PromptError } from '@/platform/remote/comfyui/types'
import { useTelemetry } from '@/platform/telemetry'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'
import { PromptExecutionError } from '@/scripts/api'
import { useDialogStore } from '@/stores/dialogStore'
import type {
  DialogComponentProps,
  DialogInstance,
  ShowDialogOptions
} from '@/stores/dialogStore'
import { tryExtractValidationError } from '@/utils/executionErrorUtil'

interface BaseConfirmOptions {
  /** Dialog heading */
  title: string
  /** The main message body */
  message: string
  /** Displayed as an unordered list immediately below the message body */
  itemList?: string[]
  hint?: string
  /**
   * Dialog-stack key, defaulting to the shared `global-prompt`. `showDialog`
   * reuses an existing entry with the same key and discards the new resolver,
   * leaving the caller's promise pending forever — a flow whose confirmation
   * must survive an already-open shared prompt passes its own key.
   */
  key?: string
}

type ConfirmOptions = BaseConfirmOptions &
  (
    | {
        /** Pre-configured dialog type */
        type: 'dirtyClose'
        /** Override the deny button label. Defaults to `g.no`. */
        denyLabel?: string
      }
    | {
        /** Pre-configured dialog type */
        type?: Exclude<ConfirmationDialogType, 'dirtyClose'>
        denyLabel?: never
      }
  )

/**
 * Minimal interface for execution error dialogs.
 * Satisfied by both ExecutionErrorWsMessage (WebSocket) and ExecutionError (Jobs API).
 */
export interface ExecutionErrorDialogInput {
  exception_type: string
  exception_message: string
  node_id?: string | number | null
  node_type?: string | null
  traceback?: string[] | null
}

const GLOBAL_PROMPT_KEY = 'global-prompt'

function getCatalogPromptError(value: unknown): PromptError | null {
  if (typeof value === 'string')
    return { type: 'error', message: value, details: '' }
  if (!isPlainObject(value)) return null

  const {
    type = 'error',
    message = '',
    details = ''
  }: Record<string, unknown> = value
  return typeof type === 'string' &&
    typeof message === 'string' &&
    typeof details === 'string'
    ? { type, message, details }
    : null
}

function getPromptErrorSources(response: unknown): RunErrorMessageSource[] {
  const parsed = zPromptErrorResponse.safeParse(response)
  if (!parsed.success) return []

  const promptError = getCatalogPromptError(parsed.data.error)
  const nodeErrors: Record<string, unknown> = isPlainObject(
    parsed.data.node_errors
  )
    ? parsed.data.node_errors
    : {}

  return [
    ...(promptError
      ? [{ kind: 'prompt' as const, error: promptError, isCloud }]
      : []),
    ...Object.entries(nodeErrors).flatMap(([nodeId, value]) => {
      if (!isPlainObject(value)) return []
      const node: Record<string, unknown> = value
      const errors: unknown[] = Array.isArray(node.errors) ? node.errors : []
      return errors.flatMap((value): RunErrorMessageSource[] => {
        if (!isPlainObject(value)) return []
        const error = getCatalogPromptError(value)
        if (!error) return []

        const extraInfo: Record<string, unknown> = isPlainObject(
          value.extra_info
        )
          ? value.extra_info
          : {}
        return [
          {
            kind: 'node_validation',
            error: {
              ...error,
              extra_info: {
                ...extraInfo,
                input_name:
                  typeof extraInfo.input_name === 'string'
                    ? extraInfo.input_name
                    : undefined
              }
            },
            nodeDisplayName:
              typeof node.class_type === 'string'
                ? `${node.class_type} (#${nodeId})`
                : `#${nodeId}`
          }
        ]
      })
    })
  ]
}

function formatDialogError(error: Error): string {
  try {
    return error.toString()
  } catch (cause) {
    if (!(error instanceof PromptExecutionError)) throw cause
    return JSON.stringify(error.response)
  }
}

// dialogStore.showDialog raises an existing dialog with the same key instead of
// wiring the new caller's callbacks, so a second concurrent caller on that key
// would never settle. Serialize FIFO per key; distinct keys stay concurrent.
const promptTails = new Map<string, Promise<unknown>>()

function enqueuePrompt<T>(
  key: string,
  show: (resolve: (value: T) => void) => void
): Promise<T> {
  const tail = promptTails.get(key) ?? Promise.resolve()
  const result = tail.then(() => new Promise<T>(show))
  const settled = result.then(
    () => undefined,
    () => undefined
  )
  promptTails.set(key, settled)
  void settled.then(() => {
    if (promptTails.get(key) === settled) promptTails.delete(key)
  })
  return result
}

export const useDialogService = () => {
  const dialogStore = useDialogStore()

  function showExecutionErrorDialog(executionError: ExecutionErrorDialogInput) {
    const validationError = tryExtractValidationError(
      executionError.exception_message
    )
    const validationSources = getPromptErrorSources(validationError)
    const props: ComponentAttrs<typeof ErrorDialogContent> = {
      errorSources: validationSources.length
        ? validationSources
        : [
            {
              kind: 'execution',
              error: executionError,
              nodeDisplayName: executionError.node_type ?? ''
            }
          ],
      error: {
        exceptionType: executionError.exception_type,
        exceptionMessage: executionError.exception_message,
        nodeId: executionError.node_id?.toString(),
        nodeType: executionError.node_type ?? undefined,
        traceback: executionError.traceback?.join('\n') ?? '',
        reportType: 'graphExecutionError'
      }
    }

    dialogStore.showDialog({
      key: 'global-execution-error',
      component: ErrorDialogContent,
      props,
      dialogComponentProps: {
        size: 'lg',
        onClose: () => {
          useTelemetry()?.trackUiButtonClicked({
            button_id: 'error_dialog_closed',
            element_group: 'error_dialog'
          })
        }
      }
    })
  }

  function parseError(error: Error) {
    const filename =
      'fileName' in error
        ? (error.fileName as string)
        : error.stack?.match(/(\/extensions\/.*\.js)/)?.[1]

    const extensionFile = filename
      ? filename.substring(filename.indexOf('/extensions/'))
      : undefined

    return {
      errorMessage: formatDialogError(error),
      stackTrace: error.stack,
      extensionFile
    }
  }

  /**
   * Show a error dialog to the user when an error occurs.
   * @param error The error to show
   * @param options The options for the dialog
   */
  function showErrorDialog(
    error: unknown,
    options: {
      title?: string
      reportType?: string
    } = {}
  ) {
    const errorProps: {
      errorMessage: string
      stackTrace?: string
      extensionFile?: string
    } =
      error instanceof Error
        ? parseError(error)
        : {
            errorMessage: String(error)
          }

    const props: ComponentAttrs<typeof ErrorDialogContent> = {
      errorSources:
        error instanceof PromptExecutionError
          ? getPromptErrorSources(error.response)
          : undefined,
      error: {
        exceptionType: options.title ?? 'Unknown Error',
        exceptionMessage: errorProps.errorMessage,
        extensionFile: errorProps.extensionFile,
        traceback: errorProps.stackTrace ?? t('errorDialog.noStackTrace'),
        reportType: options.reportType
      }
    }

    dialogStore.showDialog({
      key: 'global-error',
      component: ErrorDialogContent,
      props,
      dialogComponentProps: {
        size: 'lg',
        onClose: () => {
          useTelemetry()?.trackUiButtonClicked({
            button_id: 'error_dialog_closed',
            element_group: 'error_dialog'
          })
        }
      }
    })
  }

  async function prompt({
    title,
    message,
    defaultValue = '',
    placeholder
  }: {
    title: string
    message: string
    defaultValue?: string
    placeholder?: string
  }): Promise<string | null> {
    return enqueuePrompt<string | null>(GLOBAL_PROMPT_KEY, (resolve) => {
      dialogStore.showDialog({
        key: GLOBAL_PROMPT_KEY,
        title,
        component: PromptDialogContent,
        props: {
          message,
          defaultValue,
          onConfirm: (value: string) => {
            resolve(value)
          },
          placeholder
        },
        dialogComponentProps: {
          size: 'md',
          onRemoved: () => {
            resolve(null)
          }
        }
      })
    })
  }

  /**
   * @returns `true` if the user confirms the dialog,
   * `false` if denied (e.g. no in yes/no/cancel), or
   * `null` if the dialog is cancelled or closed
   */
  async function confirm({
    title,
    message,
    type = 'default',
    itemList = [],
    hint,
    denyLabel,
    key = GLOBAL_PROMPT_KEY
  }: ConfirmOptions): Promise<boolean | null> {
    const show = (resolve: (value: boolean | null) => void) => {
      const options: ShowDialogOptions = {
        key,
        title,
        component: ConfirmationDialogContent,
        props: {
          message,
          type,
          itemList,
          onConfirm: resolve,
          hint,
          denyLabel
        },
        dialogComponentProps: {
          size: 'md',
          onRemoved: () => resolve(null)
        }
      }

      dialogStore.showDialog(options)
    }

    return enqueuePrompt<boolean | null>(key, show)
  }

  /**
   * Shows a dialog from a third party extension.
   * @param options - The dialog options.
   * @param options.key - The dialog key.
   * @param options.title - The dialog title.
   * @param options.headerComponent - The dialog header component.
   * @param options.footerComponent - The dialog footer component.
   * @param options.component - The dialog component.
   * @param options.props - The dialog props.
   * @returns The dialog instance and a function to close the dialog.
   */
  function showExtensionDialog(options: ShowDialogOptions & { key: string }) {
    return {
      dialog: dialogStore.showExtensionDialog(options),
      closeDialog: () => dialogStore.closeDialog({ key: options.key })
    }
  }

  function showLayoutDialog<C extends Component>(options: {
    key: string
    component: C
    props: ComponentAttrs<C>
    dialogComponentProps?: DialogComponentProps
  }) {
    const layoutDefaultProps: DialogComponentProps = {
      headless: true,
      modal: true,
      closable: true
    }

    return dialogStore.showDialog({
      ...options,
      dialogComponentProps: merge(
        layoutDefaultProps,
        options.dialogComponentProps || {}
      )
    })
  }

  function showSmallLayoutDialog(
    options: Omit<ShowDialogOptions, 'dialogComponentProps'> & {
      dialogComponentProps?: DialogComponentProps
    }
  ) {
    const { dialogComponentProps: callerProps, ...rest } = options

    return dialogStore.showDialog({
      ...rest,
      dialogComponentProps: {
        closable: true,
        contentClass: `${HUG_CONTENT_CLASS} border-border-default`,
        headerClass: 'p-0',
        bodyClass: 'p-0 overflow-y-hidden',
        footerClass: 'p-0',
        ...callerProps
      }
    })
  }

  return {
    showExecutionErrorDialog,
    showErrorDialog,
    prompt,
    confirm,
    showExtensionDialog,
    showLayoutDialog,
    showSmallLayoutDialog
  }
}

type CoreDialogService = ReturnType<typeof useDialogService>

/**
 * Dialog surface exposed to extensions via `app.extensionManager.dialog`.
 * Feature dialogs live in their own composables; `createExtensionDialogService`
 * assembles them so this module never imports the features it fronts.
 */
export interface ExtensionDialogService extends CoreDialogService {
  showApiNodesSignInDialog(apiNodeNames: string[]): Promise<boolean>
  showSignInDialog(): Promise<boolean>
  showUpdatePasswordDialog(): Promise<DialogInstance>
  showTopUpCreditsDialog(
    options?: TopUpCreditsDialogOptions
  ): Promise<DialogInstance | undefined>
  showSubscriptionRequiredDialog(
    options?: SubscriptionDialogOptions
  ): Promise<void>
  showBillingComingSoonDialog(): DialogInstance
  showCancelSubscriptionDialog(
    cancelAt?: string,
    flowAlreadyOpened?: boolean,
    isScopeCurrent?: () => boolean,
    flowAlreadyConfirmed?: boolean
  ): Promise<DialogInstance | false>
  showCancelSubscriptionFlow(cancelAt?: string): Promise<void>
  showDowngradeToPersonalDialog(options: {
    planName: string
    planSlug: string
    paymentIntentSource?: PaymentIntentSource
  }): Promise<DowngradeToPersonalResult | null>
  showDeleteWorkspaceDialog(options?: {
    workspaceId?: string
    workspaceName?: string
  }): Promise<DialogInstance>
  showCreateWorkspaceDialog(
    onConfirm?: (name: string) => void | Promise<void>
  ): Promise<DialogInstance>
  showTeamWorkspacesDialog(
    onConfirm?: (name: string) => void | Promise<void>
  ): Promise<DialogInstance>
  showLeaveWorkspaceDialog(): Promise<DialogInstance>
  showEditWorkspaceDialog(): Promise<DialogInstance>
  showRemoveMemberDialog(memberId: string): Promise<DialogInstance>
  showChangeMemberRoleDialog(props: {
    memberId: string
    memberName: string
    targetRole: WorkspaceRole
  }): Promise<DialogInstance>
  showSetMemberCreditLimitDialog(props: {
    memberId: string
    memberName: string
    creditsUsed?: number
    currentLimit?: number | null
  }): Promise<DialogInstance>
  showInviteMemberDialog(): Promise<DialogInstance>
  showInviteMemberUpsellDialog(): Promise<DialogInstance>
  showInviteLinkInvalidDialog(): Promise<DialogInstance>
  showInviteWrongAccountDialog(props: {
    inviteToken: string
  }): Promise<DialogInstance>
  showRevokeInviteDialog(inviteId: string): Promise<DialogInstance>
  showCloudNotification(): Promise<void>
  showPublishDialog(): Promise<void>
}

let extensionDialogService: ExtensionDialogService | undefined

export function registerExtensionDialogService(
  service: ExtensionDialogService
) {
  extensionDialogService = service
}

export function useExtensionDialogService(): ExtensionDialogService {
  assert(
    extensionDialogService,
    'Extension dialog service accessed before registerExtensionDialogService'
  )
  return extensionDialogService
}
