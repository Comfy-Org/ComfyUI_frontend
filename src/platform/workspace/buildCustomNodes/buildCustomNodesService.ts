import { buildCustomNodesStub } from '@/platform/workspace/buildCustomNodes/buildCustomNodesStub'
import type {
  BuildCustomNode,
  DeploymentBuild,
  NodePack,
  NodePackPage,
  ReleaseBuild,
  ReleaseMove,
  SavedCustomNodes,
  ServiceOutcome,
  StartedRelease
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import type { RegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import type { components } from '@/types/comfyRegistryTypes'

type RegistryNode = components['schemas']['Node']

const NODE_PACK_PAGE_SIZE = 25

let searchGateway: RegistrySearchGateway | undefined

function registrySearch(): RegistrySearchGateway {
  searchGateway ??= useRegistrySearchGateway()
  return searchGateway
}

function parsedLicenseText(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return ''
    return 'text' in parsed && typeof parsed.text === 'string'
      ? parsed.text
      : ''
  } catch {
    return ''
  }
}

function licenseName(raw: string | undefined): string {
  if (!raw) return ''
  return raw.trimStart().startsWith('{') ? parsedLicenseText(raw) : raw
}

function toNodePacks(node: RegistryNode): NodePack[] {
  if (!node.id) return []
  return [
    {
      id: node.id,
      name: node.name ?? node.id,
      publisher: node.publisher?.name ?? node.publisher?.id ?? '',
      installs: node.downloads ?? 0,
      stars: node.github_stars ?? 0,
      license: licenseName(node.license),
      repository: node.repository,
      latestVersion: node.latest_version?.version
    }
  ]
}

/** Every backend call the Extensions node picker makes. */
export const buildCustomNodesService = {
  getDeploymentBuild(
    deploymentId: string
  ): Promise<ServiceOutcome<DeploymentBuild>> {
    return buildCustomNodesStub.getDeploymentBuild(deploymentId)
  },

  saveCustomNodes(
    deploymentId: string,
    expectedUpdatedAt: string,
    customNodes: BuildCustomNode[]
  ): Promise<ServiceOutcome<SavedCustomNodes>> {
    return buildCustomNodesStub.saveCustomNodes(
      deploymentId,
      expectedUpdatedAt,
      customNodes
    )
  },

  startRelease(deploymentId: string): Promise<ServiceOutcome<StartedRelease>> {
    return buildCustomNodesStub.startRelease(deploymentId)
  },

  getRelease(
    deploymentId: string,
    releaseId: string
  ): Promise<ServiceOutcome<ReleaseBuild>> {
    return buildCustomNodesStub.getRelease(deploymentId, releaseId)
  },

  getReleaseLog(
    deploymentId: string,
    releaseId: string
  ): Promise<ServiceOutcome<string>> {
    return buildCustomNodesStub.getReleaseLog(deploymentId, releaseId)
  },

  moveToRelease(
    deploymentId: string,
    releaseId: string,
    baseRevision: number
  ): Promise<ServiceOutcome<ReleaseMove>> {
    return buildCustomNodesStub.moveToRelease(
      deploymentId,
      releaseId,
      baseRevision
    )
  },

  async searchNodePacks(
    query: string,
    page: number
  ): Promise<ServiceOutcome<NodePackPage>> {
    const outcome = await registrySearch().searchPacks(query, {
      pageSize: NODE_PACK_PAGE_SIZE,
      pageNumber: page
    })
    if (!outcome.ok)
      return {
        ok: false,
        code: 'registry_unreachable',
        message: String(outcome.cause)
      }
    const { nodePacks, hasMore } = outcome.result
    return {
      ok: true,
      value: {
        packs: nodePacks.flatMap(toNodePacks),
        hasMore: hasMore ?? nodePacks.length === NODE_PACK_PAGE_SIZE
      }
    }
  },

  async getNodePacks(ids: readonly string[]): Promise<NodePack[]> {
    const registry = useComfyRegistryService()
    const nodes = await Promise.all(ids.map((id) => registry.getPackById(id)))
    return nodes.flatMap((node) => (node ? toNodePacks(node) : []))
  },

  async getNodePackVersions(id: string): Promise<ServiceOutcome<string[]>> {
    const registry = useComfyRegistryService()
    const versions = await registry.getPackVersions(id, {
      statuses: ['NodeVersionStatusActive']
    })
    if (versions === null)
      return {
        ok: false,
        code: 'registry_unreachable',
        message: registry.error.value ?? ''
      }
    return {
      ok: true,
      value: versions.flatMap((version) =>
        version.version && !version.deprecated ? [version.version] : []
      )
    }
  }
}
