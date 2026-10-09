import { describe, expect, it, vi } from 'vitest'
import metadata from '@/platform/community/fixtures/cloud-reference-v1/import.json'
import original from '@/platform/community/fixtures/cloud-reference-v1/workflow.json?raw'
import adapted from '@/platform/community/fixtures/cloud-reference-v1/workflow.cloud.json?raw'

import { createCommunityWorkflowRequest } from './communityWorkflowProvider'

vi.mock('@/scripts/api', () => ({ api: { fetchApi: vi.fn() } }))

const root = '/test-workflow-library/collections/harvey-qa'
const entries = Array.from({ length: 25 }, (_, index) => ({
  workflow_sha256: index.toString(16).padStart(64, '0'),
  metadata_sha256: 'a'.repeat(64),
  name: `Workflow ${index}`,
  description: 'Unknown custom node fixture',
  tags: index === 24 ? ['portrait'] : ['animation'],
  tasks: ['image generation'],
  packs: ['comfyui-kjnodes'],
  models: index === 24 ? ['flux.safetensors'] : ['wan.safetensors'],
  node_types: ['UnknownCustomNode'],
  node_count: index === 24 ? 61 : 12,
  unresolved_pack_count: 1,
  structural_cluster: 'cluster-one',
  verified: false
}))

describe('Community workflow list provider', () => {
  it('preserves verification evidence and fetches the adapted graph only for the explicit adapted choice', async () => {
    const hash = metadata.workflow_sha256
    const summary = { ...entries[0], workflow_sha256: hash }
    const read = vi.fn(async (path: string) => {
      if (path === 'index.json') return { entries: [summary] }
      if (path.endsWith('detail.json')) return { summary, metadata }
      if (path.endsWith('workflow.cloud.json')) return adapted
      return original
    })
    const request = createCommunityWorkflowRequest(read)
    const selected = await (await request(`${root}/entries/${hash}`)).json()
    expect(selected).toMatchObject({
      community_cloud_adaptation_available: true,
      metadata: {
        cloud_adaptation: metadata.cloud_adaptation,
        model_verification: metadata.model_verification,
        models: metadata.models
      }
    })
    expect(read).not.toHaveBeenCalledWith(
      `${hash}/workflow.cloud.json`,
      undefined
    )
    const untouched = await (
      await request(`${root}/entries/${hash}?include_workflow=true`)
    ).json()
    expect(untouched.workflow_json).toBe(original)
    expect(read).not.toHaveBeenCalledWith(
      `${hash}/workflow.cloud.json`,
      undefined
    )
    const cloud = await (
      await request(
        `${root}/entries/${hash}?include_workflow=true&include_cloud_workflow=true`
      )
    ).json()
    expect(cloud).toMatchObject({
      workflow_json: original,
      community_cloud_workflow_json: adapted
    })
  })
  it('keeps unsupported workflows visible and pages summaries without fetching graphs', async () => {
    const read = vi.fn().mockResolvedValue({ entries })
    const request = createCommunityWorkflowRequest(read)
    const first = await (await request(`${root}/entries`)).json()
    expect(first).toMatchObject({
      total: 25,
      verified: 0,
      unresolved: 25,
      next_cursor: '24'
    })
    expect(first.entries).toHaveLength(24)
    const last = await (await request(`${root}/entries?cursor=24`)).json()
    expect(last.entries.map((entry: { name: string }) => entry.name)).toEqual([
      'Workflow 24'
    ])
    expect(last.next_cursor).toBe('')
    expect(read).toHaveBeenCalledExactlyOnceWith('index.json', undefined)
  })

  it.each([
    'tag=portrait&pack=comfyui-kjnodes&model=flux.safetensors&task=image%20generation',
    'q=KJNODES%20FLUX%20portrait',
    'complexity=large&cluster=cluster-one'
  ])('combines search and metadata filters: %s', async (query) => {
    const request = createCommunityWorkflowRequest(async () => ({ entries }))
    const result = await (await request(`${root}/entries?${query}`)).json()
    expect(result.entries.map((entry: { name: string }) => entry.name)).toEqual(
      ['Workflow 24']
    )
  })

  it('returns an empty result for conflicting filters and rejects malformed pagination', async () => {
    const request = createCommunityWorkflowRequest(async () => ({ entries }))
    expect(
      await (
        await request(`${root}/entries?tag=portrait&model=wan.safetensors`)
      ).json()
    ).toMatchObject({ entries: [], total: 0 })
    expect((await request(`${root}/entries?cursor=-1`)).status).toBe(400)
    expect((await request(`${root}/entries?cursor=invalid`)).status).toBe(400)
  })

  it('fetches details separately and retrieves the byte-preserved original only when requested', async () => {
    const hash = entries[0].workflow_sha256
    const raw = '{\r\n"nodes":[],"links":[]\r\n}\r\n'
    const detail = {
      summary: entries[0],
      metadata: {
        schema_version: 1,
        workflow_sha256: hash,
        name: 'Unknown',
        description: '',
        tags: [],
        tasks: [],
        node_types: [],
        packs: [],
        models: [],
        prompts: [],
        structural_cluster: '',
        required_inputs: [],
        readiness: { status: 'unknown', notes: [] },
        provenance: { source: 'synthetic test', license: 'test-only' }
      },
      source_metadata_json: '{\r\n"source":"preserved"\r\n}',
      source_metadata_sha256: 'b'.repeat(64)
    }
    const read = vi.fn(async (path: string) =>
      path === 'index.json'
        ? { entries }
        : path.endsWith('detail.json')
          ? detail
          : raw
    )
    const request = createCommunityWorkflowRequest(read)
    expect(
      await (await request(`${root}/entries/${hash}`)).json()
    ).toMatchObject({ source_metadata_json: detail.source_metadata_json })
    expect(read).not.toHaveBeenCalledWith(`${hash}/workflow.json`, undefined)
    expect(
      await (
        await request(`${root}/entries/${hash}?include_workflow=true`)
      ).json()
    ).toMatchObject({ workflow_json: raw })
    expect((await request(`${root}/entries/${'f'.repeat(64)}`)).status).toBe(
      404
    )
  })
})
