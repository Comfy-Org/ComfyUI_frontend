import { uniqBy } from 'es-toolkit'

import { buildCustomNodesStub } from '@/platform/workspace/buildCustomNodes/buildCustomNodesStub'
import type {
  BuildCustomNode,
  DeploymentBuild,
  NodePack,
  ReleaseBuild,
  ReleaseMove,
  SavedCustomNodes,
  ServiceOutcome,
  StartedRelease
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import type { components } from '@/types/comfyRegistryTypes'

type RegistryNode = components['schemas']['Node']

const INDEX_PAGE_SIZE = 100
const INDEX_CONCURRENCY = 6

let nodePackIndex: Promise<ServiceOutcome<NodePack[]>> | undefined

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

function publisherName({ publisher }: RegistryNode): string {
  return publisher?.name ?? publisher?.id ?? ''
}

function toNodePack(node: RegistryNode & { id: string }): NodePack {
  return {
    id: node.id,
    name: node.name ?? node.id,
    publisher: publisherName(node),
    installs: node.downloads ?? 0,
    stars: node.github_stars ?? 0,
    license: licenseName(node.license),
    repository: node.repository,
    latestVersion: node.latest_version?.version
  }
}

function toNodePacks(node: RegistryNode): NodePack[] {
  return node.id ? [toNodePack({ ...node, id: node.id })] : []
}

type IndexPage = { nodes: RegistryNode[]; total: number } | null

async function readIndexPage(page: number): Promise<IndexPage> {
  const registry = useComfyRegistryService()
  const response = await registry.listAllPacks({ page, limit: INDEX_PAGE_SIZE })
  return response
    ? { nodes: response.nodes ?? [], total: response.total ?? 0 }
    : null
}

async function readIndexPages(pages: number[]): Promise<IndexPage[]> {
  const results: IndexPage[] = []
  for (let start = 0; start < pages.length; start += INDEX_CONCURRENCY) {
    const batch = pages.slice(start, start + INDEX_CONCURRENCY)
    results.push(...(await Promise.all(batch.map(readIndexPage))))
  }
  return results
}

async function readNodePackIndex(): Promise<ServiceOutcome<NodePack[]>> {
  const first = await readIndexPage(1)
  if (!first) return unreachableRegistry()
  const pageCount = Math.ceil(first.total / INDEX_PAGE_SIZE)
  const rest = await readIndexPages(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => index + 2)
  )
  if (rest.some((page) => page === null)) return unreachableRegistry()
  const nodes = [first, ...rest].flatMap((page) => page?.nodes ?? [])
  return {
    ok: true,
    value: uniqBy(nodes.flatMap(toNodePacks), (pack) => pack.id)
  }
}

function unreachableRegistry(): ServiceOutcome<never> {
  return {
    ok: false,
    code: 'registry_unreachable',
    message: 'The Comfy Registry did not answer.'
  }
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

  /** The whole Comfy Registry index, read once per page load and shared. */
  listNodePacks(): Promise<ServiceOutcome<NodePack[]>> {
    nodePackIndex ??= readNodePackIndex().then((outcome) => {
      if (!outcome.ok) nodePackIndex = undefined
      return outcome
    })
    return nodePackIndex
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
