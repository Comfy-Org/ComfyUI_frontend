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

export function deploymentStatusTone(status: string): DeploymentStatusTone {
  if (status === 'ready') return 'ready'
  if (status === 'stopped') return 'stopped'
  return 'pending'
}

/** Names a deployment the way the switcher shows it: its Build first, then its own name. */
function deploymentNames(t: Translate) {
  const text = (key: string, values: Record<string, string | number> = {}) =>
    t(key, values, { escapeParameter: false })

  function title(deployment: WorkspaceDeployment): string {
    if (deployment.build_name) return deployment.build_name
    const [key, values] = labelMessage(deployment)
    return text(key, values)
  }

  function subtitle(deployment: WorkspaceDeployment): string | null {
    if (!deployment.build_name) return null
    return deployment.deployment_name || shortId(deployment.deployment_id)
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
    const key = STATUS_LABEL_KEYS.get(status)
    return key ? text(key) : status
  }

  function meta(deployment: WorkspaceDeployment): string | null {
    if (deploymentStatusTone(deployment.status) !== 'ready') {
      return statusText(deployment.status)
    }
    if (deployment.release_version === undefined) return null
    return text('deploymentSwitcher.version', {
      version: deployment.release_version
    })
  }

  return { title, subtitle, fullLabel, meta }
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

/** Build and deployment name of where this page booted, or Comfy Cloud; works outside a component. */
export function useBootDeploymentFullLabel() {
  const { bootDeployment } = storeToRefs(useDeploymentPickStore())
  const { fullLabel } = deploymentNames(translate)
  return computed(() => fullLabel(bootDeployment.value ?? null))
}

export function useDeploymentLabels() {
  const { t } = useI18n()
  const { pickedDeployment, defaultDeployment } = storeToRefs(
    useDeploymentPickStore()
  )
  const names = deploymentNames(t)

  /** The pill names the Build alone; the list adds the deployment. */
  const currentTitle = computed(() =>
    pickedDeployment.value
      ? names.title(pickedDeployment.value)
      : t('deploymentSwitcher.comfyCloud')
  )
  const currentLabel = computed(() => names.fullLabel(pickedDeployment.value))
  const defaultName = computed(() =>
    defaultDeployment.value
      ? (names.subtitle(defaultDeployment.value) ??
        names.title(defaultDeployment.value))
      : null
  )

  return {
    deploymentTitle: names.title,
    deploymentSubtitle: names.subtitle,
    deploymentFullLabel: names.fullLabel,
    deploymentMeta: names.meta,
    currentTitle,
    currentLabel,
    defaultName
  }
}
