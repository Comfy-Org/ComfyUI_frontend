import type { components } from '@/types/comfyRegistryTypes'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'

type NodePack = components['schemas']['Node']
type InstallPackParams = ManagerComponents['schemas']['InstallPackParams']

export function createPackInstallPayload(
  installItem: NodePack,
  nodeIdRequiredMessage: string
): InstallPackParams {
  if (!installItem.id) throw new Error(nodeIdRequiredMessage)

  const versionToInstall =
    installItem.publisher?.name === 'Unclaimed'
      ? 'nightly'
      : (installItem.latest_version?.version ?? 'latest')

  return {
    id: installItem.id,
    repository: installItem.repository ?? '',
    channel: 'dev',
    mode: 'cache',
    selected_version: versionToInstall,
    version: versionToInstall
  }
}
