import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { partition } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import type { DeploymentRowLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import {
  COMFY_CLOUD_ROW,
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

type DeploymentSectionKey = 'runOn' | 'current' | 'compatible' | 'incompatible'

interface MarkedRow {
  value: string
  mark: DeploymentCompatibilityMark | null
}

interface DeploymentStartProblem {
  summary: string
  message: string | null
  fix: string
}

/** One row of the Run on menu, ready to render. */
export interface DeploymentRow extends DeploymentRowLabels, MarkedRow {
  note: string | null
  action: DeploymentRowAction
  actionLabel: string | null
  actionIcon: string | null
  ariaLabel: string | undefined
  problem: DeploymentStartProblem | null
}

interface DeploymentSection<Row> {
  key: DeploymentSectionKey
  rows: Row[]
}

const SECTION_LABEL_KEYS: Record<DeploymentSectionKey, string> = {
  runOn: 'deploymentSwitcher.runOn',
  current: 'deploymentSwitcher.runningOn',
  compatible: 'deploymentSwitcher.compatibleEnvironments',
  incompatible: 'deploymentSwitcher.incompatibleEnvironments'
}

const ACTION_KEYS: Partial<
  Record<
    DeploymentRowAction,
    { label: string; ariaLabel: string; icon?: string }
  >
> = {
  start: {
    label: 'deploymentSwitcher.start',
    ariaLabel: 'deploymentSwitcher.startLabel'
  },
  retry: {
    label: 'deploymentSwitcher.retry',
    ariaLabel: 'deploymentSwitcher.retryLabel'
  },
  open: {
    label: 'deploymentSwitcher.start',
    ariaLabel: 'deploymentSwitcher.startOnPlatformLabel',
    icon: 'icon-[lucide--arrow-up-right]'
  }
}

const FIX_KEYS: Record<DeploymentStartRefusal, string> = {
  noCredits: 'deploymentSwitcher.startFix.noCredits',
  tooManyRunning: 'deploymentSwitcher.startFix.tooManyRunning',
  unavailable: 'deploymentSwitcher.startFix.unavailable',
  failed: 'deploymentSwitcher.startFix.failed'
}

const REASON_KEYS: Record<DeploymentRowReason, string> = {
  stopped: 'deploymentSwitcher.reason.stopped',
  failed: 'deploymentSwitcher.reason.failed',
  starting: 'deploymentSwitcher.reason.starting',
  startElsewhere: 'deploymentSwitcher.reason.startElsewhere',
  notReady: 'deploymentSwitcher.reason.notReady'
}

/**
 * Puts the picked row first in one Run on list or, once every row is marked
 * and the marks disagree, alone above the compatible and incompatible rows.
 */
export function sectionRows<Row extends MarkedRow>(
  rows: readonly Row[],
  pickedValue: string
): DeploymentSection<Row>[] {
  const [current, others] = partition(rows, (row) => row.value === pickedValue)
  const runs = (row: Row) => row.mark?.kind === 'runs'
  const marksDisagree =
    rows.every((row) => row.mark !== null) &&
    rows.some(runs) &&
    !rows.every(runs)
  if (!marksDisagree) return [{ key: 'runOn', rows: [...current, ...others] }]
  const [compatible, incompatible] = partition(others, runs)
  const sections: DeploymentSection<Row>[] = [
    { key: 'current', rows: current },
    { key: 'compatible', rows: compatible },
    { key: 'incompatible', rows: incompatible }
  ]
  return sections.filter((section) => section.rows.length > 0)
}

/**
 * The Run on menu's rows under their headings, and the picked row's value.
 * Only a ready deployment can be picked. One the listing says can start
 * offers Start, in place when the `deployment_start_enabled` flag is on and on
 * the Developer Platform when it is off. Any row but the current one that
 * cannot be picked says why.
 */
export function useDeploymentRows() {
  const { t, locale } = useI18n()
  const { flags } = useFeatureFlags()
  const { deployments, pickedDeployment, pickedDeploymentId } = storeToRefs(
    useDeploymentPickStore()
  )
  const { starts } = storeToRefs(useDeploymentStartStore())
  const { deploymentRowLabels, deploymentFullLabel } = useDeploymentLabels()
  const { markFor } = useDeploymentCompatibility()

  function text(key: string, label: string): string {
    return t(key, { deployment: label }, { escapeParameter: false })
  }

  function nodeList(nodeTypes: string[]): string {
    return new Intl.ListFormat(locale.value).format(nodeTypes)
  }

  function compatibilityNote(
    mark: DeploymentCompatibilityMark | null,
    deployment: string
  ): string | null {
    if (mark?.kind === 'missing') {
      return t(
        'deploymentSwitcher.missingNodesNamed',
        { deployment, nodes: nodeList(mark.nodeTypes) },
        { escapeParameter: false }
      )
    }
    if (mark?.kind !== 'unknown') return null
    return t(
      'deploymentSwitcher.notCheckedNamed',
      { deployment },
      { escapeParameter: false }
    )
  }

  function compatibilityAfterReason(
    mark: DeploymentCompatibilityMark | null
  ): string | null {
    if (mark?.kind === 'missing') {
      return t(
        'deploymentSwitcher.missingNodesAfterReason',
        { nodes: nodeList(mark.nodeTypes) },
        { escapeParameter: false }
      )
    }
    if (mark?.kind !== 'unknown') return null
    return t('deploymentSwitcher.notCheckedAfterReason')
  }

  function note(
    mark: DeploymentCompatibilityMark | null,
    label: string,
    reason: string | null
  ): string | null {
    if (reason === null) return compatibilityNote(mark, label)
    const compatibility = compatibilityAfterReason(mark)
    return compatibility === null ? reason : `${reason} ${compatibility}`
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

  function actionFor(
    action: DeploymentRowAction,
    label: string
  ): Pick<
    DeploymentRow,
    'action' | 'actionLabel' | 'actionIcon' | 'ariaLabel'
  > {
    const keys = ACTION_KEYS[action]
    if (!keys) {
      return {
        action,
        actionLabel: null,
        actionIcon: null,
        ariaLabel: undefined
      }
    }
    return {
      action,
      actionLabel: t(keys.label),
      actionIcon: keys.icon ?? null,
      ariaLabel: text(keys.ariaLabel, label)
    }
  }

  function cloudRow(): DeploymentRow {
    const mark = markFor(null)
    const label = deploymentFullLabel(null)
    return {
      ...deploymentRowLabels(null),
      mark,
      note: note(mark, label, null),
      ...actionFor('pick', label),
      problem: null
    }
  }

  function deploymentRow(deployment: WorkspaceDeployment): DeploymentRow {
    const labels = deploymentRowLabels(deployment)
    const label = deploymentFullLabel(deployment)
    const mark = markFor(deployment.deployment_id)
    const start = starts.value.get(deployment.deployment_id)
    const action = deploymentRowAction(deployment, start, {
      startOffered: flags.deploymentStartEnabled
    })
    const isStarting = start?.phase === 'requested'
    const reason =
      deployment.deployment_id === pickedDeploymentId.value
        ? null
        : deploymentRowReason(deployment, action, start)
    return {
      ...labels,
      detail: isStarting
        ? t('deploymentSwitcher.status.starting')
        : labels.detail,
      tone: isStarting ? 'pending' : labels.tone,
      mark,
      note: note(
        mark,
        label,
        reason === null ? null : text(REASON_KEYS[reason], label)
      ),
      ...actionFor(action, label),
      problem: problemFor(label, start)
    }
  }

  const rows = computed(() => [
    cloudRow(),
    ...deployments.value.map(deploymentRow)
  ])

  const pickedValue = computed(
    () => pickedDeploymentId.value ?? COMFY_CLOUD_ROW
  )

  const sections = computed(() =>
    sectionRows(rows.value, pickedValue.value).map((section) => ({
      ...section,
      label: t(SECTION_LABEL_KEYS[section.key])
    }))
  )

  const pickedRow = computed(() =>
    pickedDeployment.value ? deploymentRow(pickedDeployment.value) : null
  )
  const isAnyStarting = computed(() =>
    rows.value.some((row) => row.tone === 'pending')
  )

  return { sections, pickedValue, pickedRow, isAnyStarting }
}
