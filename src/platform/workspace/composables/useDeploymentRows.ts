import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { partition } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import type { DeploymentRowLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import {
  COMFY_CLOUD_ROW,
  useDeploymentLabels
} from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

type DeploymentSectionKey = 'runOn' | 'current' | 'compatible' | 'incompatible'

interface MarkedRow {
  value: string
  mark: DeploymentCompatibilityMark | null
}

interface DeploymentRow extends DeploymentRowLabels, MarkedRow {
  compatibilityNote: string | null
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

/** The Run on menu's rows under their headings, and the picked row's value. */
export function useDeploymentRows() {
  const { t, locale } = useI18n()
  const { deployments, pickedDeploymentId } = storeToRefs(
    useDeploymentPickStore()
  )
  const { deploymentRowLabels, deploymentFullLabel } = useDeploymentLabels()
  const { markFor } = useDeploymentCompatibility()

  function compatibilityNote(
    mark: DeploymentCompatibilityMark | null,
    deployment: string
  ): string | null {
    if (mark?.kind === 'missing') {
      return t(
        'deploymentSwitcher.missingNodesNamed',
        {
          deployment,
          nodes: new Intl.ListFormat(locale.value).format(mark.nodeTypes)
        },
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

  function row(deployment: WorkspaceDeployment | null): DeploymentRow {
    const mark = markFor(deployment?.deployment_id ?? null)
    return {
      ...deploymentRowLabels(deployment),
      mark,
      compatibilityNote: compatibilityNote(
        mark,
        deploymentFullLabel(deployment)
      )
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
