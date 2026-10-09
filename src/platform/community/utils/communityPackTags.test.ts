import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import { cloudRegistryPacks } from '@/platform/customNodes/utils/cloudRegistryView'
import { communityPackTags } from './communityPackTags'

const revision: CloudNodeRegistryRevision = {
  revision_id: 'a'.repeat(64),
  name: 'ComfyUI-KJNodes',
  pack_id: 'kjnodes/immutable',
  upstream_commit: 'b'.repeat(40),
  source_sha256: 'c'.repeat(64),
  manifest_sha256: 'd'.repeat(64),
  dependency_profile_sha256: 'e'.repeat(64),
  nodes: ['ExampleNode'],
  pinned: false,
  prepared: true,
  node_api_version: 2,
  comfy_verified: false
}

describe('Community pack workflow tags', () => {
  it('searches exact pack associations by workflow use case and model without granting verification', () => {
    const tags = communityPackTags([revision], {
      entries: [
        {
          workflow_sha256: 'f'.repeat(64),
          metadata_sha256: 'e'.repeat(64),
          name: 'Portrait fixture',
          description: '',
          tags: ['portrait'],
          tasks: ['image generation'],
          models: ['flux.safetensors'],
          packs: ['registry:comfyui-kjnodes'],
          node_types: ['ExampleNode'],
          node_count: 1,
          unresolved_pack_count: 1,
          structural_cluster: '',
          verified: false
        }
      ]
    })
    expect(
      cloudRegistryPacks(
        [revision],
        'all',
        'KJNodes Flux portrait',
        '2',
        'name',
        tags,
        'portrait'
      )
    ).toHaveLength(1)
    expect(
      cloudRegistryPacks([revision], 'all', '', '2', 'name', tags, 'video')
    ).toEqual([])
    expect(
      cloudRegistryPacks([revision], 'verified', 'portrait', '2', 'name', tags)
    ).toEqual([])
  })
})
