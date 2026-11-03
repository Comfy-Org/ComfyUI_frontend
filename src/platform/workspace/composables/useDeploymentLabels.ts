import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { t as translate } from '@/i18n'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

type Translate = (
  key: string,
  named: Record<string, string | number>,
  options: { escapeParameter: boolean }
) => string

/** The switcher's radio value for Comfy Cloud; deployment rows use their id. */
export const COMFY_CLOUD_ROW = 'comfy-cloud'

/** How a deployment's status reads at a glance. */
export type DeploymentStatusTone = 'ready' | 'pending' | 'failed' | 'stopped'

/** What a switcher row shows for a deployment, or for Comfy Cloud. */
export interface DeploymentRowLabels {
  value: string
  deploymentId: string | null
  title: string
  name: string | null
  detail: string | null
  tooltip: string
  tone?: DeploymentStatusTone
}

const STATUS_LABEL_KEYS = new Map([
  ['stopped', 'deploymentSwitcher.status.stopped'],
  ['stopping', 'deploymentSwitcher.status.stopping'],
  ['failed', 'deploymentSwitcher.status.failed'],
  ['queued', 'deploymentSwitcher.status.starting'],
  ['starting', 'deploymentSwitcher.status.starting'],
  ['provisioning', 'deploymentSwitcher.status.provisioning']
])

/** `dep-f24d36bb` out of `dep-f24d36bb-fd1f-...`: enough to tell two apart. */
function shortId(deploymentId: string): string {
  return deploymentId.slice(0, 12)
}

function labelMessage(
  deployment: WorkspaceDeployment
): [key: string, values: Record<string, string | number>] {
  if (deployment.deployment_name) {
    return [
      'deploymentSwitcher.namedDeployment',
      { name: deployment.deployment_name }
    ]
  }
  if (
    deployment.build_name !== undefined &&
    deployment.release_version !== undefined
  ) {
    return [
      'deploymentSwitcher.deployment',
      { build: deployment.build_name, version: deployment.release_version }
    ]
  }
  return [
    'deploymentSwitcher.unnamedDeployment',
    { id: shortId(deployment.deployment_id) }
  ]
}

const STARTING_STATUSES = new Set(['queued', 'starting', 'provisioning'])

export function deploymentStatusTone(status: string): DeploymentStatusTone {
  if (status === 'ready') return 'ready'
  if (status === 'failed') return 'failed'
  return STARTING_STATUSES.has(status) ? 'pending' : 'stopped'
}

function deploymentNames(t: Translate) {
  const text = (key: string, values: Record<string, string | number> = {}) =>
    t(key, values, { escapeParameter: false })

  function title(deployment: WorkspaceDeployment): string {
    if (deployment.build_name) return deployment.build_name
    const [key, values] = labelMessage(deployment)
    return text(key, values)
  }

  function name(deployment: WorkspaceDeployment): string | null {
    if (deployment.build_name) {
      return deployment.deployment_name || shortId(deployment.deployment_id)
    }
    return deployment.deployment_name ? shortId(deployment.deployment_id) : null
  }

  function fullLabel(deployment: WorkspaceDeployment | null): string {
    if (!deployment) return text('deploymentSwitcher.comfyCloud')
    const deploymentName = name(deployment)
    if (deploymentName === null) return title(deployment)
    return text('deploymentSwitcher.fullLabel', {
      build: title(deployment),
      deployment: deploymentName
    })
  }

  function statusText(status: string): string {
    return text(
      STATUS_LABEL_KEYS.get(status) ?? 'deploymentSwitcher.status.notReady'
    )
  }

  function detail(deployment: WorkspaceDeployment): string | null {
    if (deployment.status !== 'ready') return statusText(deployment.status)
    if (deployment.release_version === undefined) return null
    return text('deploymentSwitcher.version', {
      version: deployment.release_version
    })
  }

  function rowTooltip(deployment: WorkspaceDeployment): string {
    const label = fullLabel(deployment)
    const rowDetail = detail(deployment)
    if (rowDetail === null) return label
    return text('deploymentSwitcher.labelWithDetail', {
      label,
      detail: rowDetail
    })
  }

  function rowLabels(
    deployment: WorkspaceDeployment | null
  ): DeploymentRowLabels {
    if (!deployment) {
      const cloud = text('deploymentSwitcher.comfyCloud')
      return {
        value: COMFY_CLOUD_ROW,
        deploymentId: null,
        title: cloud,
        name: null,
        detail: null,
        tooltip: cloud
      }
    }
    return {
      value: deployment.deployment_id,
      deploymentId: deployment.deployment_id,
      title: title(deployment),
      name: name(deployment),
      detail: detail(deployment),
      tooltip: rowTooltip(deployment),
      tone: deploymentStatusTone(deployment.status)
    }
  }

  return { title, fullLabel, rowLabels }
}

/**
 * The label of the deployment this page booted on, for text outside the
 * switcher that names where the editor runs (FE-2434); undefined on Comfy
 * Cloud and until the first listing answers. Works outside a component.
 */
export function useBootDeploymentLabel() {
  const { bootDeployment } = storeToRefs(useDeploymentPickStore())
  return computed(() => {
    if (!bootDeployment.value) return undefined
    const [key, values] = labelMessage(bootDeployment.value)
    return translate(key, values, { escapeParameter: false })
  })
}

/** Where this page booted, or Comfy Cloud; undefined until known. */
export function useBootDeploymentFullLabel() {
  const { bootDeployment, listingRefused } = storeToRefs(
    useDeploymentPickStore()
  )
  const { fullLabel } = deploymentNames(translate)
  return computed(() => {
    if (bootDeployment.value !== undefined) {
      return fullLabel(bootDeployment.value)
    }
    return listingRefused.value
      ? translate('deploymentSwitcher.comfyCloud')
      : undefined
  })
}

export function useDeploymentLabels() {
  const { t } = useI18n()
  const { pickedDeployment, defaultDeployment } = storeToRefs(
    useDeploymentPickStore()
  )
  const names = deploymentNames(t)

  const currentLabel = computed(() => names.fullLabel(pickedDeployment.value))
  const defaultTitle = computed(() =>
    defaultDeployment.value ? names.title(defaultDeployment.value) : null
  )

  return {
    deploymentRowLabels: names.rowLabels,
    deploymentFullLabel: names.fullLabel,
    currentLabel,
    defaultTitle
  }
}
