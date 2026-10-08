import { describe, expect, it } from 'vitest'

import {
  zHubWorkflowPrefillResponse,
  zHubProfileResponse,
  zSharedWorkflowResponse
} from '@/platform/workflow/sharing/schemas/shareSchemas'

describe('Hub profile compatibility', () => {
  it.for([
    {
      name: 'legacy snake-case images',
      payload: {
        name: 'Legacy creator',
        cover_image_url: 'https://example.com/cover.png',
        profile_picture_url: 'https://example.com/profile.png'
      },
      expected: {
        name: 'Legacy creator',
        coverImageUrl: 'https://example.com/cover.png',
        profilePictureUrl: 'https://example.com/profile.png'
      }
    },
    {
      name: 'camel-case fields take precedence',
      payload: {
        name: 'Preferred name',
        display_name: 'Fallback name',
        profilePictureUrl: 'https://example.com/preferred.png',
        avatar_url: 'https://example.com/fallback.png'
      },
      expected: {
        name: 'Preferred name',
        profilePictureUrl: 'https://example.com/preferred.png'
      }
    },
    {
      name: 'nullable images without optional profile details',
      payload: { avatar_url: null, cover_image_url: null },
      expected: { profilePictureUrl: null, coverImageUrl: null }
    }
  ])('accepts $name', ({ payload, expected }) => {
    expect(
      zHubProfileResponse.parse({ username: 'creator', ...payload })
    ).toEqual({ username: 'creator', ...expected })
  })
})

function makePayload(name: string) {
  return {
    share_id: 'share-1',
    workflow_id: 'wf-1',
    name,
    listed: false,
    publish_time: null,
    workflow_json: {},
    assets: []
  }
}

describe('zSharedWorkflowResponse name sanitization', () => {
  it('strips forward slashes from name', () => {
    const result = zSharedWorkflowResponse.parse(
      makePayload('../../malicious/path')
    )
    expect(result.name).toBe('.._.._malicious_path')
  })

  it('strips backslashes from name', () => {
    const result = zSharedWorkflowResponse.parse(
      makePayload('..\\..\\malicious\\path')
    )
    expect(result.name).toBe('.._.._malicious_path')
  })

  it('strips colons from name', () => {
    const result = zSharedWorkflowResponse.parse(makePayload('C:\\evil'))
    expect(result.name).toBe('C__evil')
  })

  it('truncates names exceeding 200 characters', () => {
    const longName = 'a'.repeat(300)
    const result = zSharedWorkflowResponse.parse(makePayload(longName))
    expect(result.name).toHaveLength(200)
  })

  it('preserves safe names unchanged', () => {
    const result = zSharedWorkflowResponse.parse(
      makePayload('My Cool Workflow (v2)')
    )
    expect(result.name).toBe('My Cool Workflow (v2)')
  })

  it('trims whitespace from sanitized names', () => {
    const result = zSharedWorkflowResponse.parse(makePayload('  spaced name  '))
    expect(result.name).toBe('spaced name')
  })
})

describe('zHubWorkflowPrefillResponse', () => {
  it.for(['models', 'custom_nodes', 'tutorial_url', 'metadata'] as const)(
    'keeps the title when %s is malformed',
    (field) => {
      const result = zHubWorkflowPrefillResponse.safeParse({
        name: 'Published title',
        [field]: 42
      })

      expect(result.success).toBe(true)
      expect(result.data?.name).toBe('Published title')
      expect(result.data?.[field]).toBeUndefined()
    }
  )

  it('drops a malformed tag without discarding the rest of the prefill', () => {
    const result = zHubWorkflowPrefillResponse.safeParse({
      description: 'A cool workflow',
      thumbnail_url: 'https://cdn.example.com/thumb.png',
      tags: [{ name: 'art', display_name: 'Art' }, 'rawtag', { name: 'broken' }]
    })

    expect(result.success).toBe(true)
    expect(result.data?.tags).toEqual(['Art', 'rawtag'])
    expect(result.data?.description).toBe('A cool workflow')
    expect(result.data?.thumbnail_url).toBe('https://cdn.example.com/thumb.png')
  })

  it('keeps prefill when fields the dialog never reads are absent', () => {
    const result = zHubWorkflowPrefillResponse.safeParse({
      name: 'Published title',
      description: 'A cool workflow'
    })

    expect(result.success).toBe(true)
    expect(result.data?.name).toBe('Published title')
  })

  it('keeps prefill when publish_time carries a UTC offset', () => {
    const result = zHubWorkflowPrefillResponse.safeParse({
      name: 'Published title',
      publish_time: '2026-02-23T00:00:00+00:00'
    })

    expect(result.success).toBe(true)
    expect(result.data?.name).toBe('Published title')
  })

  it('keeps prefill when the server sends an unknown thumbnail type', () => {
    const result = zHubWorkflowPrefillResponse.safeParse({
      name: 'Published title',
      thumbnail_type: 'hologram',
      thumbnail_url: 'https://cdn.example.com/thumb.png'
    })

    expect(result.success).toBe(true)
    expect(result.data?.thumbnail_type).toBeUndefined()
    expect(result.data?.thumbnail_url).toBe('https://cdn.example.com/thumb.png')
  })

  it('treats explicit nulls as absent fields', () => {
    const result = zHubWorkflowPrefillResponse.safeParse({
      name: 'Published title',
      description: null,
      tags: null,
      sample_image_urls: null
    })

    expect(result.success).toBe(true)
    expect(result.data?.description).toBeUndefined()
    expect(result.data?.name).toBe('Published title')
  })
})
