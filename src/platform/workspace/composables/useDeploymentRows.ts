import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { partition } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import type { DeploymentRowLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import {
  COMFY_CLOUD_ROW,
  deploymentStatusTone,
  useDeploymentLabels
} from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

type DeploymentSectionKey = 'runOn' | 'current' | 'compatible' | 'incompatible'

interface MarkedRow {
  value: string
  mark: DeploymentCompatibilityMark | null
}

interface DeploymentRow extends DeploymentRowLabels, MarkedRow {
  note: string | null
  pickable: boolean
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

const STOPPED_STATUSES = new Set(['stopped', 'failed'])

function reasonKey(deployment: WorkspaceDeployment): string | null {
  const tone = deploymentStatusTone(deployment.status)
  if (tone === 'ready') return null
  if (tone === 'pending') return 'deploymentSwitcher.reason.starting'
  return STOPPED_STATUSES.has(deployment.status)
    ? 'deploymentSwitcher.reason.startElsewhere'
    : 'deploymentSwitcher.reason.notReady'
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
 * Only a ready deployment can be picked, and any other row says why.
 */
export function useDeploymentRows() {
  const { t, locale } = useI18n()
  const { deployments, pickedDeploymentId } = storeToRefs(
    useDeploymentPickStore()
  )
  const { deploymentRowLabels, deploymentFullLabel } = useDeploymentLabels()
  const { markFor } = useDeploymentCompatibility()

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

  function pickReason(
    deployment: WorkspaceDeployment | null,
    label: string
  ): string | null {
    const key =
      deployment === null ||
      deployment.deployment_id === pickedDeploymentId.value
        ? null
        : reasonKey(deployment)
    if (key === null) return null
    return t(key, { deployment: label }, { escapeParameter: false })
  }

  function note(
    mark: DeploymentCompatibilityMark | null,
    deployment: WorkspaceDeployment | null
  ): string | null {
    const label = deploymentFullLabel(deployment)
    const reason = pickReason(deployment, label)
    if (reason === null) return compatibilityNote(mark, label)
    const compatibility = compatibilityAfterReason(mark)
    return compatibility === null ? reason : `${reason} ${compatibility}`
  }

  function row(deployment: WorkspaceDeployment | null): DeploymentRow {
    const mark = markFor(deployment?.deployment_id ?? null)
    return {
      ...deploymentRowLabels(deployment),
      mark,
      note: note(mark, deployment),
      pickable:
        deployment === null ||
        pendingServerFact('BE-24332', deployment.status === 'ready')
    }
  }

  const pickedValue = computed(
    () => pickedDeploymentId.value ?? COMFY_CLOUD_ROW
  )

  const sections = computed(() =>
    sectionRows(
      [row(null), ...deployments.value.map((d) => row(d))],
      pickedValue.value
    ).map((section) => ({
      ...section,
      label: t(SECTION_LABEL_KEYS[section.key])
    }))
  )

  return { sections, pickedValue }
}
