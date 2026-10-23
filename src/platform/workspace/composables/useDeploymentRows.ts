import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { partition } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import type { DeploymentStatusTone } from '@/platform/workspace/composables/useDeploymentLabels'
import {
  COMFY_CLOUD_ROW,
  deploymentStatusTone,
  useDeploymentLabels
} from '@/platform/workspace/composables/useDeploymentLabels'
import type {
  DeploymentRowAction,
  DeploymentRowReason,
  DeploymentStart,
  DeploymentStartRefusal
} from '@/platform/workspace/deploymentStartState'
import {
  deploymentRowAction,
  deploymentRowReason
} from '@/platform/workspace/deploymentStartState'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useDeploymentStartStore } from '@/platform/workspace/stores/deploymentStartStore'

/** Why a Start did not happen, said under the deployment's row. */
interface DeploymentStartProblem {
  summary: string
  message: string | null
  fix: string
}

/** One row of the Run on menu, ready to render. */
export interface DeploymentRow {
  value: string
  deploymentId: string | null
  title: string
  name: string | null
  detail: string | null
  tooltip: string
  tone?: DeploymentStatusTone
  note: string | null
  action: DeploymentRowAction
  actionLabel: string | null
  ariaLabel: string | undefined
  problem: DeploymentStartProblem | null
}

interface DeploymentSection {
  key: 'all' | 'compatible' | 'incompatible'
  label: string
  rows: DeploymentRow[]
}

const ACTION_KEYS: Partial<
  Record<DeploymentRowAction, { label: string; ariaLabel: string }>
> = {
  start: {
    label: 'deploymentSwitcher.start',
    ariaLabel: 'deploymentSwitcher.startLabel'
  },
  retry: {
    label: 'deploymentSwitcher.retry',
    ariaLabel: 'deploymentSwitcher.retryLabel'
  }
}

const FIX_KEYS: Record<DeploymentStartRefusal, string> = {
  noCredits: 'deploymentSwitcher.startFix.noCredits',
  tooManyRunning: 'deploymentSwitcher.startFix.tooManyRunning',
  notAllowed: 'deploymentSwitcher.startFix.notAllowed',
  unavailable: 'deploymentSwitcher.startFix.unavailable',
  failed: 'deploymentSwitcher.startFix.failed'
}

const REASON_KEYS: Record<DeploymentRowReason, string> = {
  stopped: 'deploymentSwitcher.reason.stopped',
  failed: 'deploymentSwitcher.reason.failed',
  starting: 'deploymentSwitcher.reason.starting',
  startElsewhere: 'deploymentSwitcher.reason.startElsewhere',
  notAllowed: 'deploymentSwitcher.reason.notAllowed',
  notReady: 'deploymentSwitcher.reason.notReady'
}

/**
 * The Run on menu's rows, Comfy Cloud first. Only a ready deployment can be
 * picked, and a stopped or failed one offers Start when the
 * `deployment_start_enabled` flag is on. Once a compatibility check answers,
 * rows that run the open workflow come first under their own label.
 */
export function useDeploymentRows() {
  const { t, locale } = useI18n()
  const { flags } = useFeatureFlags()
  const { deployments, pickedDeployment } = storeToRefs(
    useDeploymentPickStore()
  )
  const { starts } = storeToRefs(useDeploymentStartStore())
  const {
    deploymentTitle,
    deploymentName,
    deploymentDetail,
    deploymentTooltip,
    deploymentFullLabel
  } = useDeploymentLabels()
  const { markFor } = useDeploymentCompatibility()

  function text(key: string, label: string): string {
    return t(key, { deployment: label }, { escapeParameter: false })
  }

  function missingNodeNames(deploymentId: string | null): string | null {
    const mark = markFor(deploymentId)
    if (mark?.kind !== 'missing') return null
    return new Intl.ListFormat(locale.value).format(mark.nodeTypes)
  }

  function noteFor(
    deploymentId: string | null,
    label: string,
    reason: string | null
  ): string | null {
    const nodes = missingNodeNames(deploymentId)
    if (nodes === null) return reason
    if (reason === null) {
      return t(
        'deploymentSwitcher.missingNodesNamed',
        { deployment: label, nodes },
        { escapeParameter: false }
      )
    }
    const missing = t(
      'deploymentSwitcher.missingNodesAfterReason',
      { nodes },
      { escapeParameter: false }
    )
    return `${reason} ${missing}`
  }

  function problemFor(
    label: string,
    start: DeploymentStart | undefined
  ): DeploymentStartProblem | null {
    if (start?.phase !== 'refused') return null
    return {
      summary: text('deploymentSwitcher.startFailed', label),
      message: start.message,
      fix: t(FIX_KEYS[start.reason])
    }
  }

  function cloudRow(): DeploymentRow {
    const title = t('deploymentSwitcher.comfyCloud')
    return {
      value: COMFY_CLOUD_ROW,
      deploymentId: null,
      title,
      name: null,
      detail: null,
      tooltip: title,
      note: noteFor(null, title, null),
      action: 'pick',
      actionLabel: null,
      ariaLabel: undefined,
      problem: null
    }
  }

  function deploymentRow(deployment: WorkspaceDeployment): DeploymentRow {
    const label = deploymentFullLabel(deployment)
    const start = starts.value.get(deployment.deployment_id)
    const action = deploymentRowAction(deployment.status, start, {
      startOffered: flags.deploymentStartEnabled
    })
    const isStarting =
      start?.phase === 'requested' || start?.phase === 'accepted'
    const reason = deploymentRowReason(deployment.status, action, start)
    const actionKeys = ACTION_KEYS[action]
    return {
      value: deployment.deployment_id,
      deploymentId: deployment.deployment_id,
      title: deploymentTitle(deployment),
      name: deploymentName(deployment),
      detail: isStarting
        ? t('deploymentSwitcher.status.starting')
        : deploymentDetail(deployment),
      tooltip: deploymentTooltip(deployment),
      tone: isStarting ? 'pending' : deploymentStatusTone(deployment.status),
      note: noteFor(
        deployment.deployment_id,
        label,
        reason === null ? null : text(REASON_KEYS[reason], label)
      ),
      action,
      actionLabel: actionKeys ? t(actionKeys.label) : null,
      ariaLabel: actionKeys ? text(actionKeys.ariaLabel, label) : undefined,
      problem: problemFor(label, start)
    }
  }

  const rows = computed(() => [
    cloudRow(),
    ...deployments.value.map(deploymentRow)
  ])

  const sections = computed<DeploymentSection[]>(() => {
    const [compatible, incompatible] = partition(
      rows.value,
      (row) => markFor(row.deploymentId)?.kind === 'runs'
    )
    if (compatible.length === 0 || incompatible.length === 0) {
      return [
        { key: 'all', label: t('deploymentSwitcher.runOn'), rows: rows.value }
      ]
    }
    return [
      {
        key: 'compatible',
        label: t('deploymentSwitcher.compatibleEnvironments'),
        rows: compatible
      },
      {
        key: 'incompatible',
        label: t('deploymentSwitcher.incompatibleEnvironments'),
        rows: incompatible
      }
    ]
  })

  const pickedRow = computed(() =>
    pickedDeployment.value ? deploymentRow(pickedDeployment.value) : null
  )
  const isAnyStarting = computed(() =>
    rows.value.some((row) => row.tone === 'pending')
  )

  return { sections, pickedRow, isAnyStarting }
}
