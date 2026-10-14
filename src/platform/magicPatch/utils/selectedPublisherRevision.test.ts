import type {
  CloudNodeRegistry,
  CloudNodeRegistryRevision
} from '@comfyorg/ingest-types'
import type { RequestStatus } from '@comfyorg/magic-patch-types'
import { describe, expect, it } from 'vitest'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  applyPublicationNodeTypes,
  completionExecutionFromVerifiedReport,
  publicationFromVerifiedReport,
  selectedPublisherRevision
} from './selectedPublisherRevision'
import { workflowPackBindings } from './workflowPackCandidates'

const source: CloudNodeRegistryRevision = {
  revision_id: 'a'.repeat(64),
  pack_id: 'randomnumbers',
  name: 'RandomNumbers',
  upstream_commit: 'b'.repeat(40),
  source_sha256: 'c'.repeat(64),
  manifest_sha256: 'd'.repeat(64),
  dependency_profile_sha256: 'e'.repeat(64),
  nodes: ['RandomNumber'],
  prepared: false,
  pinned: false,
  node_api_version: 1
}
const native: CloudNodeRegistryRevision = {
  ...source,
  account_owned: true,
  pack_id: 'user-owner/actual-pack',
  revision_id: 'f'.repeat(64),
  upstream_commit: '',
  nodes: ['User_owner_RandomNumber'],
  prepared: true,
  pinned: true,
  node_api_version: 2
}
const request: RequestStatus = {
  id: '1'.repeat(32),
  operation_id: '2'.repeat(32),
  state: 'ready',
  operation_status: 'completed',
  status_version: 2,
  release_id: '9'.repeat(64),
  report_sha256: '3'.repeat(64)
}
const association = {
  schema: 'magic-patch-publication/v1',
  request_id: request.id,
  source_pack_id: source.pack_id,
  source_revision_id: source.revision_id,
  installed_pack_id: native.pack_id,
  installed_revision_id: native.revision_id,
  node_types: { RandomNumber: 'User_owner_RandomNumber' }
}
const catalog: CloudNodeRegistry = {
  corpus_commit: 'test',
  pins: [native.revision_id],
  revisions: [native]
}

describe('authenticated completion execution mode', () => {
  const fresh = {
    format: 'private-magic-completion-report/1',
    request_id: request.id,
    operation_id: request.operation_id,
    execution_mode: 'fresh_model',
    fresh_model_execution: true,
    publication_association: {
      ...association,
      schema: 'magic-patch-publication/v2',
      source_node_stamps: [
        {
          class_type: 'RandomNumber',
          cnr_id: source.pack_id,
          ver: source.revision_id
        }
      ]
    },
    native_result_sha256: 'a'.repeat(64),
    fresh_cli_result_sha256: 'b'.repeat(64)
  }
  const cached = {
    ...fresh,
    execution_mode: 'cached_patch',
    fresh_model_execution: false,
    cache_provenance: {
      execution_mode: 'cached_patch',
      fresh_model_execution: false,
      fresh_model_invoked: false,
      archive_id: 'c'.repeat(64),
      archive_record_sha256: 'd'.repeat(64),
      origin_request_id: '4'.repeat(32),
      origin_operation_id: '5'.repeat(32)
    }
  }
  const cacheReport = () => {
    return {
      format: fresh.format,
      request_id: request.id,
      operation_id: request.operation_id,
      execution_mode: cached.execution_mode,
      fresh_model_execution: false,
      native_result_sha256: fresh.native_result_sha256,
      publication_association: fresh.publication_association,
      cache_provenance: structuredClone(cached.cache_provenance)
    }
  }

  it('distinguishes a new model run from a newly validated saved conversion', () => {
    expect(completionExecutionFromVerifiedReport(fresh, request)).toBe(
      'fresh_model'
    )
    expect(completionExecutionFromVerifiedReport(cacheReport(), request)).toBe(
      'cached_patch'
    )
  })

  it('does not claim a model mode for a generic publication report', () => {
    expect(
      completionExecutionFromVerifiedReport(
        { publication_association: association },
        request
      )
    ).toBe('unspecified')
  })

  it.for(['native_result_sha256', 'fresh_cli_result_sha256'])(
    'refuses fresh completion without its %s',
    (field) => {
      expect(
        completionExecutionFromVerifiedReport(
          { ...fresh, [field]: '' },
          request
        )
      ).toBeUndefined()
    }
  )

  it('refuses cache provenance relabelled as a new model run', () => {
    expect(
      completionExecutionFromVerifiedReport(
        { ...fresh, cache_provenance: cached.cache_provenance },
        request
      )
    ).toBeUndefined()
    expect(
      completionExecutionFromVerifiedReport(cached, request)
    ).toBeUndefined()
  })

  it.for(['request_id', 'operation_id'])(
    'refuses completion for another current %s',
    (field) => {
      expect(
        completionExecutionFromVerifiedReport(
          { ...cacheReport(), [field]: '9'.repeat(32) },
          request
        )
      ).toBeUndefined()
    }
  )

  it.for(['archive_id', 'archive_record_sha256'] as const)(
    'refuses saved conversion without its immutable %s',
    (field) => {
      const report = cacheReport()
      report.cache_provenance[field] = ''
      expect(
        completionExecutionFromVerifiedReport(report, request)
      ).toBeUndefined()
    }
  )

  it('refuses a saved conversion pretending its origin is the current job', () => {
    const report = cacheReport()
    report.cache_provenance.origin_request_id = request.id
    expect(
      completionExecutionFromVerifiedReport(report, request)
    ).toBeUndefined()
    report.cache_provenance.origin_request_id =
      cached.cache_provenance.origin_request_id
    report.cache_provenance.origin_operation_id = request.operation_id
    expect(
      completionExecutionFromVerifiedReport(report, request)
    ).toBeUndefined()
  })

  it('refuses cache mode with a model-execution claim', () => {
    const report = cacheReport()
    report.cache_provenance.fresh_model_invoked = true
    expect(
      completionExecutionFromVerifiedReport(report, request)
    ).toBeUndefined()
  })

  it('refuses null mode/model declarations rather than treating them as omitted', () => {
    expect(
      completionExecutionFromVerifiedReport(
        { ...fresh, execution_mode: null },
        request
      )
    ).toBeUndefined()
    expect(
      completionExecutionFromVerifiedReport(
        { ...fresh, fresh_model_execution: null },
        request
      )
    ).toBeUndefined()
  })
})

describe('verified publication association', () => {
  it('accepts an explicit original-source to different account-native relation without release aliases', () => {
    const publication = publicationFromVerifiedReport(
      { publication_association: association },
      request,
      source
    )
    expect(publication?.installedRevisionId).toBe(native.revision_id)
    expect(publication?.installedRevisionId).not.toBe(request.release_id)
    expect(publication && selectedPublisherRevision(publication, catalog)).toBe(
      native
    )
  })

  it.for(['request_id', 'source_pack_id', 'source_revision_id'])(
    'refuses a report linked to another %s',
    (key) => {
      expect(
        publicationFromVerifiedReport(
          {
            publication_association: {
              ...association,
              [key]: 'wrong'
            }
          },
          request,
          source
        )
      ).toBeUndefined()
    }
  )

  it('refuses release-only readiness, missing report SHA, and incomplete node associations', () => {
    expect(publicationFromVerifiedReport({}, request, source)).toBeUndefined()
    expect(
      publicationFromVerifiedReport(
        { publication_association: association },
        {
          ...request,
          report_sha256: undefined
        },
        source
      )
    ).toBeUndefined()
    expect(
      publicationFromVerifiedReport(
        {
          publication_association: {
            ...association,
            node_types: {}
          }
        },
        request,
        source
      )
    ).toBeUndefined()
  })

  it.for([
    { account_owned: false },
    { pack_id: 'another-account/pack' },
    { prepared: false },
    { node_api_version: 1 as const },
    { nodes: ['AnotherNode'] }
  ])(
    'refuses an installed row that does not confirm the association: %j',
    (change) => {
      const publication = publicationFromVerifiedReport(
        { publication_association: association },
        request,
        source
      )
      expect(
        publication &&
          selectedPublisherRevision(publication, {
            ...catalog,
            revisions: [{ ...native, ...change }]
          })
      ).toBeUndefined()
    }
  )

  it('retargets only explicitly associated source nodes and preserves latest edits and original snapshot', () => {
    const graph: ComfyWorkflowJSON = {
      last_node_id: 2,
      last_link_id: 0,
      links: [],
      groups: [],
      config: {},
      version: 0.4,
      nodes: [
        {
          id: 1,
          type: 'RandomNumber',
          pos: [42, 84],
          size: [140, 100],
          flags: {},
          order: 0,
          mode: 0,
          title: 'Edited title',
          widgets_values: [123],
          properties: {
            cnr_id: source.pack_id,
            ver: 'original-semver',
            userEdit: 'keep'
          }
        },
        {
          id: 2,
          type: 'RandomNumber',
          pos: [3, 4],
          size: [140, 100],
          flags: {},
          order: 1,
          mode: 0,
          widgets_values: [456],
          properties: { cnr_id: 'unrelated-pack' }
        }
      ]
    }
    const original = structuredClone(graph)
    const publication = publicationFromVerifiedReport(
      { publication_association: association },
      request,
      source
    )
    if (!publication) throw new Error('fixture association is invalid')
    const latest = applyPublicationNodeTypes(
      structuredClone(graph),
      [publication],
      original
    )
    expect(latest.nodes[0]).toMatchObject({
      id: 1,
      type: 'User_owner_RandomNumber',
      title: 'Edited title',
      pos: [42, 84],
      widgets_values: [123],
      properties: {
        cnr_id: native.pack_id,
        ver: native.revision_id,
        userEdit: 'keep'
      }
    })
    expect(latest.nodes[1]).toEqual(graph.nodes[1])
    expect(graph).toEqual(original)
    expect(original.nodes[0]!.type).toBe('RandomNumber')
  })

  it('preserves a source-version edit made while conversion runs', () => {
    const original: ComfyWorkflowJSON = {
      last_node_id: 1,
      last_link_id: 0,
      links: [],
      groups: [],
      config: {},
      version: 0.4,
      nodes: [
        {
          id: 1,
          type: 'RandomNumber',
          pos: [1, 2],
          size: [140, 100],
          flags: {},
          order: 0,
          mode: 0,
          properties: { cnr_id: source.pack_id, ver: 'original' }
        }
      ]
    }
    const latest = structuredClone(original)
    latest.nodes[0]!.properties = {
      ...latest.nodes[0]!.properties,
      ver: 'edited-version'
    }
    const publication = publicationFromVerifiedReport(
      { publication_association: association },
      request,
      source
    )
    if (!publication) throw new Error('fixture association is invalid')
    applyPublicationNodeTypes(latest, [publication], original)
    expect(latest.nodes[0]!.type).toBe('RandomNumber')
    expect(latest.nodes[0]!.properties?.ver).toBe('edited-version')
  })
})

const literalVersion = '32931f09a754880c938cc24f62b868f351c6e626'
const stampedSource: CloudNodeRegistryRevision = {
  ...source,
  pack_id: 'comfyui-easy-use/x58e077a',
  nodes: ['easy imageRemBg']
}
const stamp = {
  class_type: 'easy imageRemBg',
  cnr_id: 'comfyui-easy-use',
  ver: literalVersion
}
const stampedAssociation = {
  ...association,
  schema: 'magic-patch-publication/v2',
  source_pack_id: stampedSource.pack_id,
  node_types: { 'easy imageRemBg': 'User_owner_RandomNumber' },
  source_node_stamps: [stamp]
}
function stampedGraph(
  version: string | undefined = literalVersion
): ComfyWorkflowJSON {
  return {
    last_node_id: 1,
    last_link_id: 0,
    links: [],
    groups: [],
    config: {},
    version: 0.4,
    nodes: [
      {
        id: 1,
        type: 'easy imageRemBg',
        pos: [1, 2],
        size: [140, 100],
        flags: {},
        order: 0,
        mode: 0,
        widgets_values: [123],
        properties: {
          cnr_id: stamp.cnr_id,
          ...(version === undefined ? {} : { ver: version })
        }
      }
    ]
  }
}
function stampedPublication(override: Record<string, unknown> = {}) {
  return publicationFromVerifiedReport(
    {
      publication_association: { ...stampedAssociation, ...override }
    },
    request,
    stampedSource
  )
}
describe('authoritative workflow stamp association', () => {
  it('reloads a shorter community ID only with its captured unambiguous Registry binding and a canonical source stamp', () => {
    const canonicalSource = { ...source, pack_id: 'randomnumbers/x1234567' }
    const graph = stampedGraph(canonicalSource.upstream_commit)
    graph.nodes[0]!.type = 'RandomNumber'
    graph.nodes[0]!.properties = {
      cnr_id: 'randomnumbers',
      ver: canonicalSource.upstream_commit
    }
    const bindings = workflowPackBindings(graph, [canonicalSource])
    const publication: NonNullable<
      ReturnType<typeof publicationFromVerifiedReport>
    > = {
      sourcePackId: canonicalSource.pack_id,
      sourceRevisionId: canonicalSource.revision_id,
      installedPackId: native.pack_id,
      installedRevisionId: native.revision_id,
      nodeTypes: { RandomNumber: 'User_owner_RandomNumber' },
      sourceNodeStamps: [
        {
          type: 'RandomNumber',
          cnrId: canonicalSource.pack_id,
          version: canonicalSource.revision_id
        }
      ]
    }
    const latest = structuredClone(graph)
    latest.nodes[0]!.widgets_values = [456]
    applyPublicationNodeTypes(latest, [publication], graph, bindings)
    expect(latest.nodes[0]).toMatchObject({
      type: 'User_owner_RandomNumber',
      widgets_values: [456]
    })
    const edited = structuredClone(graph)
    edited.nodes[0]!.properties!.ver = 'another-version'
    applyPublicationNodeTypes(edited, [publication], graph, bindings)
    expect(edited.nodes[0]!.type).toBe('RandomNumber')
    const wrong = structuredClone(graph)
    applyPublicationNodeTypes(
      wrong,
      [{ ...publication, sourceRevisionId: 'e'.repeat(64) }],
      graph,
      bindings
    )
    expect(wrong.nodes[0]!.type).toBe('RandomNumber')
  })
  it('remaps a bare cnr_id only through the explicit verified Registry source association', () => {
    const publication = stampedPublication()
    if (!publication) throw new Error('fixture v2 association is invalid')
    expect(publication.sourcePackId).toBe('comfyui-easy-use/x58e077a')
    expect(publication.sourceNodeStamps).toEqual([
      {
        type: 'easy imageRemBg',
        cnrId: stamp.cnr_id,
        version: literalVersion
      }
    ])
    const original = stampedGraph()
    const latest = structuredClone(original)
    latest.nodes[0]!.pos = [42, 84]
    latest.nodes[0]!.widgets_values = [456]
    applyPublicationNodeTypes(latest, [publication], original)
    expect(latest.nodes[0]).toMatchObject({
      type: 'User_owner_RandomNumber',
      pos: [42, 84],
      widgets_values: [456],
      properties: { cnr_id: native.pack_id, ver: native.revision_id }
    })
    expect(original.nodes[0]).toMatchObject({
      type: stamp.class_type,
      properties: { cnr_id: stamp.cnr_id, ver: literalVersion }
    })
  })

  it('never infers a bare pack or workflow Git revision alias from a v1 report', () => {
    const publication = stampedPublication({
      schema: 'magic-patch-publication/v1',
      source_node_stamps: undefined
    })
    if (!publication) throw new Error('fixture v1 association is invalid')
    const original = stampedGraph()
    const latest = structuredClone(original)
    applyPublicationNodeTypes(latest, [publication], original)
    expect(latest).toEqual(original)
  })

  it('preserves a changed workflow version and refuses a report for a different original stamp', () => {
    const publication = stampedPublication()
    if (!publication) throw new Error('fixture v2 association is invalid')
    const original = stampedGraph()
    const edited = stampedGraph('edited-version')
    applyPublicationNodeTypes(edited, [publication], original)
    expect(edited.nodes[0]!.type).toBe(stamp.class_type)
    expect(edited.nodes[0]!.properties?.ver).toBe('edited-version')
    const wrong = stampedPublication({
      source_node_stamps: [{ ...stamp, ver: 'another-original-version' }]
    })
    if (!wrong) throw new Error('fixture alternate association is invalid')
    const latest = structuredClone(original)
    applyPublicationNodeTypes(latest, [wrong], original)
    expect(latest).toEqual(original)
  })

  it('keeps a newly added node unchanged even when its class and version match', () => {
    const publication = stampedPublication()
    if (!publication) throw new Error('fixture v2 association is invalid')
    const original = stampedGraph()
    const latest = structuredClone(original)
    latest.nodes.push({ ...structuredClone(original.nodes[0]!), id: 2 })
    applyPublicationNodeTypes(latest, [publication], original)
    expect(latest.nodes[0]!.type).toBe('User_owner_RandomNumber')
    expect(latest.nodes[1]!.type).toBe(stamp.class_type)
    expect(latest.nodes[1]!.properties?.ver).toBe(literalVersion)
  })

  it('requires the immutable original snapshot before applying any node association', () => {
    const publication = stampedPublication()
    if (!publication) throw new Error('fixture v2 association is invalid')
    const graph = stampedGraph()
    const before = structuredClone(graph)
    applyPublicationNodeTypes(graph, [publication])
    expect(graph).toEqual(before)
  })

  it('preserves the absence of a version without manufacturing a latest alias', () => {
    const publication = stampedPublication({
      source_node_stamps: [
        { class_type: stamp.class_type, cnr_id: stamp.cnr_id }
      ]
    })
    if (!publication)
      throw new Error('fixture unversioned association is invalid')
    const original = stampedGraph()
    delete original.nodes[0]!.properties?.ver
    const latest = structuredClone(original)
    applyPublicationNodeTypes(latest, [publication], original)
    expect(latest.nodes[0]!.type).toBe('User_owner_RandomNumber')
    expect(original.nodes[0]!.properties).not.toHaveProperty('ver')
    const invented = stampedGraph('latest')
    applyPublicationNodeTypes(invented, [publication], original)
    expect(invented.nodes[0]!.type).toBe(stamp.class_type)
  })

  it.for([
    undefined,
    [],
    [{ ...stamp, class_type: 'different-class' }],
    [{ ...stamp, ver: 123 }],
    [{ ...stamp, ver: null }]
  ])('rejects v2 without valid explicit source node stamps: %j', (stamps) => {
    expect(stampedPublication({ source_node_stamps: stamps })).toBeUndefined()
  })

  it('rejects duplicate stamp claims', () => {
    expect(
      stampedPublication({ source_node_stamps: [stamp, stamp] })
    ).toBeUndefined()
  })
})
