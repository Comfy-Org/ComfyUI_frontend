import { ref } from 'vue'

import { t } from '@/i18n'
import { app } from '@/scripts/app'
import type {
  IBaseWidget,
  IComboWidget
} from '@/lib/litegraph/src/types/widgets'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useModelStore } from '@/stores/modelStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { resolveComboValues } from '@/utils/litegraphUtil'

function findCandidateWidget(candidate: MissingModelCandidate) {
  if (candidate.nodeId == null || !app.rootGraph) return undefined

  const node = getNodeByExecutionId(app.rootGraph, String(candidate.nodeId))
  return node?.widgets?.find((w) => w.name === candidate.widgetName)
}

function isComboWidget(widget: IBaseWidget): widget is IComboWidget {
  return widget.type === 'combo'
}

function isCandidateValueStillSelected(
  candidate: MissingModelCandidate
): boolean {
  return findCandidateWidget(candidate)?.value === candidate.name
}

function isCandidateInWidgetOptions(candidate: MissingModelCandidate): boolean {
  const widget = findCandidateWidget(candidate)
  if (!widget || !isComboWidget(widget)) return false

  return resolveComboValues(widget).includes(candidate.name)
}

function getCandidateKey(candidate: MissingModelCandidate): string {
  return [
    String(candidate.nodeId),
    candidate.widgetName,
    candidate.name,
    candidate.directory ?? ''
  ].join('::')
}

function syncActiveWorkflowMissingModels(candidates: MissingModelCandidate[]) {
  const activeWorkflow = useWorkspaceStore().workflow.activeWorkflow
  if (!activeWorkflow) return

  activeWorkflow.pendingWarnings = {
    ...activeWorkflow.pendingWarnings,
    missingModelCandidates: candidates.length ? candidates : undefined
  }

  if (
    !activeWorkflow.pendingWarnings.missingNodeTypes?.length &&
    !activeWorkflow.pendingWarnings.missingModelCandidates?.length &&
    !activeWorkflow.pendingWarnings.missingMediaCandidates?.length
  ) {
    activeWorkflow.pendingWarnings = null
  }
}

/**
 * Rechecks the currently surfaced missing model candidates against fresh
 * object_info/model folder data and removes only candidates confirmed fixed.
 */
export function useMissingModelRefresh() {
  const missingModelStore = useMissingModelStore()
  const modelStore = useModelStore()
  const toastStore = useToastStore()
  const isRefreshingMissingModels = ref(false)

  async function isCandidateStillMissing(
    candidate: MissingModelCandidate
  ): Promise<{ isStillMissing: boolean; hadError: boolean }> {
    try {
      if (candidate.nodeId != null) {
        if (!isCandidateValueStillSelected(candidate)) {
          return { isStillMissing: false, hadError: false }
        }
        if (isCandidateInWidgetOptions(candidate)) {
          return { isStillMissing: false, hadError: false }
        }
      }

      if (!candidate.directory) {
        return { isStillMissing: true, hadError: false }
      }

      const folder = await modelStore.getLoadedModelFolder(candidate.directory)
      const models = folder?.models
      if (!models) return { isStillMissing: true, hadError: false }

      return {
        isStillMissing: !Object.values(models).some(
          (m) => m.file_name === candidate.name
        ),
        hadError: false
      }
    } catch (error) {
      console.error(
        `[Missing Model] Failed to verify missing model in ${candidate.directory ?? 'unknown directory'}:`,
        error
      )
      return { isStillMissing: true, hadError: true }
    }
  }

  function showRefreshFailedToast(resolvedCount: number) {
    toastStore.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t(
        resolvedCount > 0
          ? 'rightSidePanel.missingModels.refreshPartiallyFailed'
          : 'rightSidePanel.missingModels.refreshFailed'
      )
    })
  }

  function removeResolvedCandidates(resolvedCandidateKeys: Set<string>) {
    if (resolvedCandidateKeys.size === 0) return

    const currentCandidates = missingModelStore.missingModelCandidates ?? []
    const remaining = currentCandidates.filter(
      (candidate) => !resolvedCandidateKeys.has(getCandidateKey(candidate))
    )

    missingModelStore.setMissingModels(remaining)
    syncActiveWorkflowMissingModels(remaining)
  }

  async function refreshMissingModels() {
    const candidates = missingModelStore.missingModelCandidates
    if (!candidates?.length || isRefreshingMissingModels.value) return

    isRefreshingMissingModels.value = true
    let hadRefreshError = false
    async function runRefreshStep(label: string, run: () => Promise<unknown>) {
      try {
        await run()
      } catch (error) {
        hadRefreshError = true
        console.error(`[Missing Model] Failed to ${label}:`, error)
      }
    }

    try {
      await runRefreshStep('refresh object info', () =>
        app.refreshComboInNodes({ silent: true })
      )
      await runRefreshStep('refresh model folders', () =>
        modelStore.loadModelFolders()
      )

      const stillMissingResults = await Promise.all(
        candidates.map(async (candidate) => ({
          candidate,
          ...(await isCandidateStillMissing(candidate))
        }))
      )
      const resolvedCandidateKeys = new Set(
        stillMissingResults
          .filter((result) => !result.isStillMissing)
          .map((result) => getCandidateKey(result.candidate))
      )
      const resolvedCount = resolvedCandidateKeys.size

      removeResolvedCandidates(resolvedCandidateKeys)

      if (hadRefreshError || stillMissingResults.some((r) => r.hadError)) {
        showRefreshFailedToast(resolvedCount)
      }
    } catch (error) {
      console.error('[Missing Model] Failed to refresh missing models:', error)
      showRefreshFailedToast(0)
    } finally {
      isRefreshingMissingModels.value = false
    }
  }

  return {
    isRefreshingMissingModels,
    refreshMissingModels
  }
}
