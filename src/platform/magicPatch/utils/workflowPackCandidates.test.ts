import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'
import {
  convertedWorkflowPackCandidates,
  workflowPackCandidates
} from './workflowPackCandidates'

const source: CloudNodeRegistryRevision = {
  pack_id: 'randomnumbers/x1234567',
  revision_id: 'a'.repeat(64),
  name: 'RandomNumbers',
  upstream_commit: 'b'.repeat(40),
  source_sha256: 'c'.repeat(64),
  dependency_profile_sha256: 'd'.repeat(64),
  manifest_sha256: 'e'.repeat(64),
  nodes: ['RandomNumber'],
  node_api_version: 1,
  pinned: false,
  prepared: false
}
describe('workflow pack discovery', () => {
  it('keeps all existing V2 revisions for explicit selection instead of reconverting an ambiguous pack', () => {
    const node = {
      type: 'RandomNumber',
      properties: { aux_id: 'kijai/ComfyUI-KJNodes' }
    }
    const converted: CloudNodeRegistryRevision[] = [
      { ...source, pack_id: 'comfyui-kjnodes/x1234567', node_api_version: 2 },
      {
        ...source,
        pack_id: 'comfyui-kjnodes/x1234567',
        revision_id: 'f'.repeat(64),
        node_api_version: 2
      }
    ]
    const revisions = [
      { ...source, pack_id: 'comfyui-kjnodes/x1234567' },
      ...converted
    ]
    expect(convertedWorkflowPackCandidates(node, revisions)).toEqual(converted)
    expect(workflowPackCandidates(node, revisions)).toEqual([])
  })

  it('does not substitute a converted revision for a different exact workflow version', () => {
    const converted: CloudNodeRegistryRevision = {
      ...source,
      node_api_version: 2
    }
    const node = {
      type: 'RandomNumber',
      properties: { cnr_id: 'randomnumbers', ver: 'f'.repeat(40) }
    }
    expect(convertedWorkflowPackCandidates(node, [converted])).toEqual([])
    const unconverted = { ...source, upstream_commit: node.properties.ver }
    expect(workflowPackCandidates(node, [converted, unconverted])).toEqual([
      unconverted
    ])
  })

  it('matches a community hyphenated ID to its local underscore slug while keeping the exact Git revision', () => {
    const localSource = { ...source, pack_id: 'comfyui_randomnumbers/x1234567' }
    expect(
      workflowPackCandidates(
        {
          type: 'RandomNumber',
          properties: {
            cnr_id: 'comfyui-randomnumbers',
            ver: localSource.upstream_commit
          }
        },
        [localSource]
      )
    ).toEqual([localSource])
    expect(
      workflowPackCandidates(
        {
          type: 'RandomNumber',
          properties: { cnr_id: 'comfyui-randomnumbers', ver: 'e'.repeat(40) }
        },
        [localSource]
      )
    ).toEqual([])
  })
  it('matches community pack IDs and exact upstream Git versions', () => {
    expect(
      workflowPackCandidates(
        {
          type: 'RandomNumber',
          properties: {
            cnr_id: 'randomnumbers',
            ver: source.upstream_commit
          }
        },
        [source]
      )
    ).toEqual([source])
  })
  it('finds a missing node without pack metadata only when its source is unambiguous', () => {
    const node = { type: 'RandomNumber' }
    expect(workflowPackCandidates(node, [source])).toEqual([source])
    expect(
      workflowPackCandidates(node, [
        source,
        { ...source, pack_id: 'another/x7654321', revision_id: 'd'.repeat(64) }
      ])
    ).toEqual([])
  })
  it.for(['e'.repeat(40), 'f'.repeat(64)])(
    'refuses a workflow bound to another revision: %s',
    (version) => {
      expect(
        workflowPackCandidates(
          {
            type: 'RandomNumber',
            properties: { cnr_id: 'randomnumbers', ver: version }
          },
          [source]
        )
      ).toEqual([])
    }
  )
  it('does not convert an already V2 pack or a node belonging to a different pack', () => {
    expect(
      workflowPackCandidates({ type: 'RandomNumber' }, [
        { ...source, node_api_version: 2 }
      ])
    ).toEqual([])
    expect(
      workflowPackCandidates(
        { type: 'RandomNumber', properties: { cnr_id: 'different' } },
        [source]
      )
    ).toEqual([])
  })
})
