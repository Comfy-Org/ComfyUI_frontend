import { PromptExecutionError } from '@comfyorg/api-client/ComfyApi'
import type { PromptError } from '@comfyorg/api-client/types'
import type { NodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
import { getWorkflowMode } from '@comfyorg/graph-model/appMode'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { normalizeExecutionTriggerSource } from '@comfyorg/telemetry/types'
import type {
  ExecutionContext,
  WorkflowExecutionContext,
  WorkflowExecutionIntent,
  WorkflowQueueIntent
} from '@comfyorg/telemetry/types'

import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  getGraphLoadGeneration,
  isGraphLoading
} from '@/core/graph/graphLoadState'
import { applyPromotedWidgetControl } from '@/core/graph/subgraph/promotedWidgetControl'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { t } from '@/i18n'
import { isDesktopHostSignedIn } from '@/platform/auth/desktopHost/desktopHostSession'
import { queueAuthToken } from '@/platform/auth/partnerNode/partnerNodeQueueToken'
import { partnerRunGateBlocksAutoQueue } from '@/platform/auth/partnerNode/usePartnerNodesRunGate'
import { useAccountPreconditionDialog } from '@/platform/billing/subscription/composables/useAccountPreconditionDialog'
import { useFreeTierQuota } from '@/platform/billing/subscription/composables/useFreeTierQuota'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { getExecutionContext } from '@/platform/telemetry/utils/getExecutionContext'
import { toWorkflowExecutionContext } from '@/platform/telemetry/utils/workflowExecutionContext'
import { promptBuildErrorFingerprint } from '@/platform/workflow/execution/promptBuildErrorFingerprint'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import {
  promptErrorHasLockedCredits,
  promptRefusalPrecondition,
  resolveAccountPrecondition,
  withRefusalReason
} from '@/platform/workflowErrors/errorCatalog/accountPreconditionRouting'
import { rescanAndSurfaceMissingNodes } from '@/platform/workflowErrors/nodeReplacement/missingNodeScan'
import {
  handledReleaseChange,
  loadedReleaseId
} from '@/platform/workspace/loadedRelease'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { useDialogService } from '@/services/dialogService'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { ComfyApp, QueuePromptOptions } from '@/types/comfy'
import { normalizePromptError } from '@/utils/executionErrorUtil'
import { collectAllNodes, forEachNode } from '@/utils/graphTraversalUtil'
import { executeWidgetsCallback } from '@/utils/litegraphUtil'

function hasQueueingGraphReloadedInPlace(
  graph: LGraph,
  queueingGraphGeneration: number
): boolean {
  return (
    isGraphLoading(graph) ||
    getGraphLoadGeneration(graph) !== queueingGraphGeneration
  )
}

function servedRefusal(error: unknown): unknown {
  if (!useFeatureFlags().flags.billingNewUxEnabled) return undefined
  return error instanceof PromptExecutionError
    ? error.response.error
    : undefined
}

function unshapedPromptFailure(
  error: PromptExecutionError
): PromptError | null {
  if (Object.keys(error.response.node_errors ?? {}).length > 0) return null
  return {
    type: 'server_error',
    message: error.toString() || `HTTP ${error.status ?? 'error'}`,
    details: ''
  }
}

function withCloudRefusalReason(promptError: PromptError, error: unknown) {
  return isCloud
    ? withRefusalReason(promptError, servedRefusal(error))
    : promptError
}

export class QueueSubmission {
  private queueItems: {
    number: number
    batchCount: number
    requestId: number
    queueNodeIds?: NodeExecutionId[]
    workflowQueueIntent?: WorkflowQueueIntent
    queueingWorkflowKey: string | undefined
    queueingGraph: LGraph
    queueingGraphGeneration: number
  }[] = []
  private nextQueueRequestId = 1
  private processingQueue = false

  constructor(private readonly app: ComfyApp) {}

  async queuePrompt(
    number: number,
    batchCount: number,
    optionsOrQueueNodeIds: QueuePromptOptions | NodeExecutionId[]
  ): Promise<boolean> {
    const options = Array.isArray(optionsOrQueueNodeIds)
      ? { queueNodeIds: optionsOrQueueNodeIds }
      : optionsOrQueueNodeIds
    const { queueNodeIds, intent } = options
    if (
      intent?.trigger_source === 'auto_queue' &&
      partnerRunGateBlocksAutoQueue()
    ) {
      return false
    }
    const requestId = this.nextQueueRequestId++
    const queueingWorkflow = useWorkspaceStore().workflow.activeWorkflow as
      | ComfyWorkflow
      | undefined
    this.queueItems.push({
      number,
      batchCount,
      queueNodeIds,
      requestId,
      workflowQueueIntent: intent,
      queueingWorkflowKey:
        queueingWorkflow?.instanceId ?? queueingWorkflow?.path,
      queueingGraph: queueingWorkflow?.graph ?? this.app.rootGraph,
      queueingGraphGeneration: getGraphLoadGeneration(
        queueingWorkflow?.graph ?? this.app.rootGraph
      )
    })
    api.dispatchCustomEvent('promptQueueing', {
      requestId,
      batchCount
    })

    if (this.processingQueue) {
      return false
    }

    this.processingQueue = true
    const executionStore = useExecutionStore()
    const executionErrorStore = useExecutionErrorStore()
    const telemetry = useTelemetry()
    executionErrorStore.clearRunErrors()
    let queueResultOverride: boolean | null = null

    const teamWorkspaceStore = useTeamWorkspaceStore()
    try {
      await teamWorkspaceStore.waitForWorkspaceSwitch()
    } catch (error) {
      useDialogService().showErrorDialog(error, {
        title: t('errorDialog.promptExecutionError'),
        reportType: 'promptExecutionError'
      })
      this.queueItems.length = 0
      this.processingQueue = false
      return false
    }
    const workspaceIdBeforeAuthentication = teamWorkspaceStore.activeWorkspaceId
    const workspaceGenerationBeforeAuthentication =
      teamWorkspaceStore.workspaceTransitionGeneration
    const workspaceAuthToken = await useAuthStore().getWorkspaceAuthToken()
    const executionWorkspaceId = teamWorkspaceStore.activeWorkspaceId
    const executionWorkspaceGeneration =
      teamWorkspaceStore.workspaceTransitionGeneration
    const comfyOrgAuthToken = await queueAuthToken(
      workspaceAuthToken,
      executionWorkspaceId
    )
    const workspaceChangedWhileAuthenticating =
      (workspaceIdBeforeAuthentication !== executionWorkspaceId ||
        workspaceGenerationBeforeAuthentication !==
          executionWorkspaceGeneration) &&
      (isCloud || workspaceIdBeforeAuthentication !== null)
    const desktopHostAuth = isDesktopHostSignedIn()
    const comfyOrgApiKey = desktopHostAuth
      ? null
      : useApiKeyAuthStore().getApiKey()
    const isApiKeySessionExecution =
      !desktopHostAuth &&
      !useAuthStore().currentUser &&
      !useAuthStore().sessionOnlyUser &&
      useApiKeyAuthStore().isAuthenticated
    if (
      executionWorkspaceId &&
      !comfyOrgAuthToken &&
      !isApiKeySessionExecution
    ) {
      useDialogService().showErrorDialog(
        new Error(t('toastMessages.userNotAuthenticated')),
        {
          title: t('errorDialog.promptExecutionError'),
          reportType: 'promptExecutionError'
        }
      )
      this.queueItems.length = 0
      this.processingQueue = false
      return false
    }

    try {
      while (this.queueItems.length) {
        const {
          number,
          batchCount,
          queueNodeIds,
          requestId,
          workflowQueueIntent,
          queueingWorkflowKey,
          queueingGraph,
          queueingGraphGeneration
        } = this.queueItems.pop()!
        let queuedCount = 0
        let acceptedCount = 0
        const workflowExecutionIntent: WorkflowExecutionIntent = {
          trigger_source: normalizeExecutionTriggerSource(
            workflowQueueIntent?.trigger_source
          )
        }
        const previewMethod = useSettingStore().get(
          'Comfy.Execution.PreviewMethod'
        )

        const isPartialExecution = !!queueNodeIds?.length
        let stoppedOnWorkflowChange = false
        for (let i = 0; i < batchCount; i++) {
          const currentWorkflow = useWorkspaceStore().workflow
            .activeWorkflow as ComfyWorkflow | undefined
          const currentWorkflowKey =
            currentWorkflow?.instanceId ?? currentWorkflow?.path
          if (
            currentWorkflowKey !== queueingWorkflowKey ||
            this.app.rootGraph !== queueingGraph ||
            hasQueueingGraphReloadedInPlace(
              queueingGraph,
              queueingGraphGeneration
            )
          ) {
            stoppedOnWorkflowChange = true
            break
          }
          let executionContext: ExecutionContext | undefined
          let submissionAccepted = false
          if (telemetry) {
            try {
              executionContext = getExecutionContext()
            } catch (error) {
              console.error(
                '[Telemetry] Workflow context collection failed',
                error
              )
            }
          }

          const queuedNodes = collectAllNodes(queueingGraph)

          forEachNode(queueingGraph, (node) => {
            for (const widget of node.widgets ?? []) {
              widget.beforeQueued?.({ isPartialExecution })
            }
            applyPromotedWidgetControl(node, 'beforeQueued')
          })

          const queuedWorkflow = useWorkspaceStore().workflow
            .activeWorkflow as ComfyWorkflow
          const queuedRunErrorKey = executionErrorStore.captureRunErrorKey()
          const queuedMode = getWorkflowMode(queuedWorkflow)
          const startTime = performance.now()
          const p = await this.app
            .graphToPrompt(queueingGraph)
            .catch((error: unknown) => {
              telemetry?.trackExecutionOutcome({
                startTime,
                endTime: performance.now(),
                success: false,
                failureReason: 'prompt_build_failed',
                ...workflowExecutionIntent
              })
              reportError(error, {
                surface: 'graph',
                errorType: 'error_building_prompt',
                fingerprint: promptBuildErrorFingerprint(error),
                logToConsole: false
              })
              throw error
            })
          if (
            hasQueueingGraphReloadedInPlace(
              queueingGraph,
              queueingGraphGeneration
            )
          ) {
            stoppedOnWorkflowChange = true
            break
          }
          let workflowContext: WorkflowExecutionContext | undefined
          if (executionContext) {
            workflowContext = toWorkflowExecutionContext(executionContext, {
              executableNodeCount: Object.keys(p.output).length,
              executionScope: isPartialExecution ? 'partial' : 'full',
              viewMode: queuedMode
            })
          }
          if (
            workspaceChangedWhileAuthenticating ||
            executionWorkspaceId !== teamWorkspaceStore.activeWorkspaceId ||
            executionWorkspaceGeneration !==
              teamWorkspaceStore.workspaceTransitionGeneration
          ) {
            useDialogService().showErrorDialog(
              new Error(t('errorDialog.workspaceChangedDuringExecution')),
              {
                title: t('errorDialog.promptExecutionError'),
                reportType: 'promptExecutionError'
              }
            )
            queueResultOverride = false
            break
          }
          try {
            api.authToken = comfyOrgAuthToken
            api.apiKey = comfyOrgApiKey ?? undefined
            api.loadedReleaseId = loadedReleaseId()
            executionErrorStore.recordNodeErrors(null, queuedRunErrorKey)
            const res = await api.queuePrompt(number, p, {
              partialExecutionTargets: queueNodeIds,
              previewMethod
            })
            const responseReceivedAt = performance.now()
            delete api.authToken
            delete api.apiKey
            delete api.loadedReleaseId
            submissionAccepted = Boolean(res.prompt_id)
            if (!res.prompt_id) {
              telemetry?.trackExecutionOutcome({
                startTime,
                endTime: responseReceivedAt,
                success: false,
                failureReason: 'submission_rejected',
                ...workflowExecutionIntent,
                ...(workflowContext && { workflowContext })
              })
            }
            executionErrorStore.recordSubmissionNodeErrors(
              res.node_errors,
              queuedRunErrorKey,
              res.prompt_id
            )
            queueResultOverride = null
            try {
              if (res.prompt_id) {
                executionStore.storeJob({
                  id: res.prompt_id,
                  nodes: Object.keys(p.output),
                  promptOutput: p.output,
                  startTime,
                  submissionAcceptedAt: responseReceivedAt,
                  workflow: queuedWorkflow,
                  mode: queuedMode,
                  workflowContext,
                  workflowExecutionIntent
                })
              }
            } catch (error) {
              console.warn('Failed to store queued job metadata', {
                promptId: res.prompt_id,
                error
              })
            }
            if (executionErrorStore.hasNodeError) {
              if (useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')) {
                executionErrorStore.showErrorOverlay()
              }
              this.app.canvas.draw(true, true)
            }
          } catch (error: unknown) {
            telemetry?.trackExecutionOutcome({
              startTime,
              endTime: performance.now(),
              success: false,
              failureReason:
                error instanceof PromptExecutionError
                  ? 'submission_rejected'
                  : 'submission_failed',
              ...workflowExecutionIntent,
              ...(workflowContext && { workflowContext })
            })
            if (error instanceof PromptExecutionError) {
              queueResultOverride = !error.response.node_errors
            }
            if (handledReleaseChange(error)) {
              queueResultOverride = false
              break
            }
            const hasPromptNodeErrors =
              error instanceof PromptExecutionError &&
              Object.keys(error.response.node_errors ?? {}).length > 0
            const promptError =
              error instanceof PromptExecutionError
                ? (normalizePromptError(error.response.error) ??
                  unshapedPromptFailure(error))
                : null
            const promptPrecondition = promptError
              ? (resolveAccountPrecondition({
                  exceptionType: promptError.type,
                  exceptionMessage: promptError.message
                }) ?? promptRefusalPrecondition(servedRefusal(error)))
              : undefined
            if (promptPrecondition) {
              const opened = await useAccountPreconditionDialog().open(
                promptPrecondition,
                {
                  runRefused: true,
                  creditsLocked: promptErrorHasLockedCredits(
                    error instanceof PromptExecutionError
                      ? error.response.error
                      : null
                  ),
                  ...(promptError?.type &&
                    promptError.type !== 'error' && {
                      refusalType: promptError.type
                    })
                }
              )
              if (opened) {
                console.error(error)
                break
              }
            }
            if (
              error instanceof PromptExecutionError &&
              promptError?.type === 'missing_node_type'
            ) {
              rescanAndSurfaceMissingNodes(this.app.rootGraph)
            } else if (
              error instanceof PromptExecutionError &&
              error.status === 403 &&
              !hasPromptNodeErrors
            ) {
              const raw: Record<string, unknown> = error.response
              const rawError =
                raw.error && typeof raw.error === 'object'
                  ? (raw.error as Record<string, unknown>)
                  : undefined
              const detail =
                typeof raw.message === 'string'
                  ? raw.message
                  : typeof rawError?.message === 'string'
                    ? rawError.message
                    : typeof raw.error === 'string'
                      ? raw.error
                      : t('errorDialog.accessRestrictedMessage')
              useDialogService().showErrorDialog(new Error(detail), {
                title: t('errorDialog.accessRestrictedTitle'),
                reportType: 'accessRestrictedError'
              })
            } else if (
              !useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab') ||
              !(error instanceof PromptExecutionError)
            ) {
              useDialogService().showErrorDialog(error, {
                title: t('errorDialog.promptExecutionError'),
                reportType: 'promptExecutionError'
              })
            }
            console.error(error)

            if (error instanceof PromptExecutionError) {
              const nodeErrors = error.response.node_errors
              executionErrorStore.recordNodeErrors(
                nodeErrors ?? null,
                queuedRunErrorKey
              )

              if (
                (!nodeErrors || Object.keys(nodeErrors).length === 0) &&
                promptError
              ) {
                executionErrorStore.recordPromptError(
                  withCloudRefusalReason(promptError, error),
                  queuedRunErrorKey
                )
              }

              if (useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')) {
                executionErrorStore.showErrorOverlay()
              }
              this.app.canvas.draw(true, true)
            }
            break
          }

          queuedCount++
          if (submissionAccepted) {
            acceptedCount++
          }

          executeWidgetsCallback(queuedNodes, 'afterQueued', {
            isPartialExecution
          })
          for (const node of queuedNodes) {
            applyPromotedWidgetControl(node, 'afterQueued')
          }
          useFreeTierQuota().trackRun()
        }

        if (stoppedOnWorkflowChange) {
          useToast().warning(
            t('toastMessages.batchStoppedOnWorkflowChange', {
              queued: acceptedCount,
              requested: batchCount
            })
          )
        }

        if (queuedCount > 0) {
          this.app.canvas.draw(true, true)
          void this.app.ui.queue.update().catch((error) => {
            reportError(error, {
              surface: 'graph',
              errorType: 'queue_ui_update_failure'
            })
          })
          api.dispatchCustomEvent('promptQueued', {
            number,
            batchCount: queuedCount,
            requestId
          })
        }
      }
    } finally {
      this.processingQueue = false
    }
    return queueResultOverride ?? !executionErrorStore.lastNodeErrors
  }
}
