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

/** How a deployment's status reads at a glance: ready, stopped, or on its way. */
export type DeploymentStatusTone = 'ready' | 'stopped' | 'pending'

const STATUS_LABEL_KEYS = new Map([
  ['stopped', 'deploymentSwitcher.status.stopped'],
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

const STARTING_STATUSES = new Set(['starting', 'provisioning'])

export function deploymentStatusTone(status: string): DeploymentStatusTone {
  if (status === 'ready') return 'ready'
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

  function subtitle(deployment: WorkspaceDeployment): string | null {
    if (deployment.build_name) {
      return deployment.deployment_name || shortId(deployment.deployment_id)
    }
    return deployment.deployment_name ? shortId(deployment.deployment_id) : null
  }

  function fullLabel(deployment: WorkspaceDeployment | null): string {
    if (!deployment) return text('deploymentSwitcher.comfyCloud')
    const name = subtitle(deployment)
    if (name === null) return title(deployment)
    return text('deploymentSwitcher.fullLabel', {
      build: title(deployment),
      deployment: name
    })
  }

  function statusText(status: string): string {
    return text(
      STATUS_LABEL_KEYS.get(status) ?? 'deploymentSwitcher.status.notReady'
    )
  }

  function rowSubtitle(deployment: WorkspaceDeployment): string | null {
    const name = subtitle(deployment)
    if (name === null || deployment.release_version === undefined) return name
    return text('deploymentSwitcher.nameWithVersion', {
      name,
      version: deployment.release_version
    })
  }

  function meta(deployment: WorkspaceDeployment): string | null {
    return deploymentStatusTone(deployment.status) === 'ready'
      ? null
      : statusText(deployment.status)
  }

  return { title, subtitle, rowSubtitle, fullLabel, meta }
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
    deploymentTitle: names.title,
    deploymentRowSubtitle: names.rowSubtitle,
    deploymentFullLabel: names.fullLabel,
    deploymentMeta: names.meta,
    currentLabel,
    defaultTitle
  }
}
