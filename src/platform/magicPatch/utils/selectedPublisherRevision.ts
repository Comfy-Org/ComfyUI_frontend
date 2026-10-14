import type {
  CloudNodeRegistry,
  CloudNodeRegistryRevision
} from '@comfyorg/ingest-types'
import type { RequestStatus } from '@comfyorg/magic-patch-types'
import { collectSubgraphDefinitions } from '@/platform/workflow/core/utils/workflowFlattening'
import type { FlattenableWorkflowNode } from '@/platform/workflow/core/utils/workflowFlattening'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { WorkflowPackBinding } from './workflowPackCandidates'

type SourceNodeStamp = {
  type: string
  cnrId: string
  version?: string
}

/** Frontend projection of a verified authenticated report, not an API response DTO. */
export type InstalledPublication = {
  sourcePackId: CloudNodeRegistryRevision['pack_id']
  sourceRevisionId: CloudNodeRegistryRevision['revision_id']
  installedPackId: CloudNodeRegistryRevision['pack_id']
  installedRevisionId: CloudNodeRegistryRevision['revision_id']
  nodeTypes: Readonly<Record<string, string>>
  sourceNodeStamps?: readonly SourceNodeStamp[]
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function identifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    value.trim() === value &&
    Array.from(value).every((character) => character.charCodeAt(0) >= 32)
  )
}

export type CompletionExecutionMode =
  | 'fresh_model'
  | 'cached_patch'
  | 'unspecified'

/** Classify only the authenticated report already digest-verified by the client. */
export function completionExecutionFromVerifiedReport(
  report: unknown,
  request: RequestStatus
): CompletionExecutionMode | undefined {
  const value = object(report)
  if (!value) return
  if (
    value.format !== 'private-magic-completion-report/1' &&
    !Object.hasOwn(value, 'execution_mode')
  )
    return 'unspecified'
  const hash = (candidate: unknown): candidate is string =>
    typeof candidate === 'string' && /^[a-f0-9]{64}$/u.test(candidate)
  const operation = (candidate: unknown): candidate is string =>
    typeof candidate === 'string' && /^[a-f0-9]{32}$/u.test(candidate)
  if (
    value.format !== 'private-magic-completion-report/1' ||
    value.request_id !== request.id ||
    value.operation_id !== request.operation_id ||
    object(value.publication_association)?.schema !==
      'magic-patch-publication/v2' ||
    !operation(value.request_id) ||
    !operation(value.operation_id) ||
    !hash(value.native_result_sha256)
  )
    return
  const mode = Object.hasOwn(value, 'execution_mode')
    ? value.execution_mode
    : 'fresh_model'
  if (mode === 'fresh_model')
    return (!Object.hasOwn(value, 'fresh_model_execution') ||
      value.fresh_model_execution === true) &&
      hash(value.fresh_cli_result_sha256) &&
      !Object.hasOwn(value, 'cache_provenance')
      ? 'fresh_model'
      : undefined
  const cache = object(value.cache_provenance)
  if (
    mode !== 'cached_patch' ||
    value.fresh_model_execution !== false ||
    Object.hasOwn(value, 'fresh_cli_result_sha256') ||
    !cache ||
    cache.execution_mode !== 'cached_patch' ||
    cache.fresh_model_execution !== false ||
    cache.fresh_model_invoked !== false ||
    !hash(cache.archive_id) ||
    !hash(cache.archive_record_sha256) ||
    !operation(cache.origin_request_id) ||
    !operation(cache.origin_operation_id) ||
    cache.origin_request_id === request.id ||
    cache.origin_operation_id === request.operation_id
  )
    return
  return 'cached_patch'
}

/** Only consume a report already verified byte-for-byte by client.report. */
export function publicationFromVerifiedReport(
  report: unknown,
  request: RequestStatus,
  source: CloudNodeRegistryRevision
): InstalledPublication | undefined {
  const association = object(object(report)?.publication_association)
  const nodes = object(association?.node_types)
  if (
    request.state !== 'ready' ||
    !request.report_sha256 ||
    !association ||
    typeof association.schema !== 'string' ||
    !['magic-patch-publication/v1', 'magic-patch-publication/v2'].includes(
      association.schema
    ) ||
    association.request_id !== request.id ||
    association.source_pack_id !== source.pack_id ||
    association.source_revision_id !== source.revision_id ||
    !identifier(association.installed_pack_id) ||
    typeof association.installed_revision_id !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(association.installed_revision_id) ||
    !nodes ||
    !source.nodes.length
  )
    return
  const entries = Object.entries(nodes)
  if (
    entries.length !== source.nodes.length ||
    entries.some(
      ([name, target]) =>
        !source.nodes.includes(name) ||
        !identifier(target) ||
        ['__proto__', 'prototype', 'constructor'].includes(name)
    ) ||
    source.nodes.some((name) => !Object.hasOwn(nodes, name)) ||
    new Set(entries.map(([, target]) => target)).size !== entries.length
  )
    return
  let sourceNodeStamps: SourceNodeStamp[] | undefined
  if (association.schema === 'magic-patch-publication/v2') {
    const stamps = association.source_node_stamps
    if (!Array.isArray(stamps) || !stamps.length || stamps.length > 10000)
      return
    sourceNodeStamps = []
    const seen = new Set<string>()
    for (const value of stamps) {
      const stamp = object(value)
      if (
        !stamp ||
        !identifier(stamp.class_type) ||
        !source.nodes.includes(stamp.class_type) ||
        !identifier(stamp.cnr_id) ||
        (Object.hasOwn(stamp, 'ver') && !identifier(stamp.ver))
      )
        return
      const version = Object.hasOwn(stamp, 'ver')
        ? (stamp.ver as string)
        : undefined
      const key = JSON.stringify([stamp.class_type, stamp.cnr_id, version])
      if (seen.has(key)) return
      seen.add(key)
      sourceNodeStamps.push({
        type: stamp.class_type,
        cnrId: stamp.cnr_id,
        ...(version === undefined ? {} : { version })
      })
    }
  }
  return {
    sourcePackId: source.pack_id,
    sourceRevisionId: source.revision_id,
    installedPackId: association.installed_pack_id,
    installedRevisionId: association.installed_revision_id,
    nodeTypes: Object.fromEntries(entries) as Record<string, string>,
    ...(sourceNodeStamps === undefined ? {} : { sourceNodeStamps })
  }
}

export function selectedPublisherRevision(
  publication: InstalledPublication,
  catalog: CloudNodeRegistry
): CloudNodeRegistryRevision | undefined {
  const matches = catalog.revisions.filter(
    (revision) => revision.revision_id === publication.installedRevisionId
  )
  const revision = matches.length === 1 ? matches[0] : undefined
  if (
    !revision ||
    revision.account_owned !== true ||
    revision.pack_id !== publication.installedPackId ||
    revision.node_api_version !== 2 ||
    !revision.prepared ||
    Object.values(publication.nodeTypes).some(
      (name) => !revision.nodes.includes(name)
    )
  )
    return
  return revision
}

/** Apply only proven stamps on the same original node, preserving later edits. */
export function applyPublicationNodeTypes(
  graph: ComfyWorkflowJSON,
  publications: readonly InstalledPublication[],
  original?: ComfyWorkflowJSON,
  bindings: readonly WorkflowPackBinding[] = []
): ComfyWorkflowJSON {
  if (!original) return graph
  const originalNodes = new Map<string, FlattenableWorkflowNode>()
  const key = (scope: string | null, node: FlattenableWorkflowNode) =>
    JSON.stringify([scope, node.id])
  for (const node of original.nodes) originalNodes.set(key(null, node), node)
  for (const definition of collectSubgraphDefinitions(
    original.definitions?.subgraphs ?? []
  )) {
    for (const node of definition.nodes)
      originalNodes.set(key(definition.id, node), node)
  }
  function remap(node: FlattenableWorkflowNode, scope: string | null) {
    const previous = originalNodes.get(key(scope, node))
    if (
      !previous ||
      previous.type !== node.type ||
      previous.properties?.cnr_id !== node.properties?.cnr_id ||
      previous.properties?.ver !== node.properties?.ver
    )
      return
    const matching = publications.filter((publication) => {
      if (!Object.hasOwn(publication.nodeTypes, node.type)) return false
      if (publication.sourceNodeStamps) {
        return publication.sourceNodeStamps.some(
          (stamp) =>
            stamp.type === node.type &&
            ((stamp.cnrId === node.properties?.cnr_id &&
              stamp.version === node.properties?.ver) ||
              (stamp.cnrId === publication.sourcePackId &&
                stamp.version === publication.sourceRevisionId &&
                bindings.some(
                  (binding) =>
                    binding.scope === scope &&
                    binding.id === node.id &&
                    binding.type === node.type &&
                    binding.sourcePackId === publication.sourcePackId &&
                    binding.sourceRevisionId === publication.sourceRevisionId
                )))
        )
      }
      // v1 has no stamp proof; only the original exact source pack ID qualifies.
      return node.properties?.cnr_id === publication.sourcePackId
    })
    if (matching.length !== 1) return
    const publication = matching[0]
    if (!publication) return
    const type = publication.nodeTypes[node.type]
    if (!type) return
    node.type = type
    node.properties = {
      ...node.properties,
      cnr_id: publication.installedPackId,
      ver: publication.installedRevisionId
    }
  }
  for (const node of graph.nodes) remap(node, null)
  for (const definition of collectSubgraphDefinitions(
    graph.definitions?.subgraphs ?? []
  )) {
    for (const node of definition.nodes) remap(node, definition.id)
  }
  return graph
}
