import { describe, expect, it } from 'vitest'

import type { HubCreator, HubCreatorsSnapshot } from './creators'
import {
  creatorEntityNode,
  creatorMetaDescription,
  creatorWorkflowTemplate,
  hubCreators
} from './creators'

type Workflow = HubCreatorsSnapshot['workflows'][number]
type Profile = HubCreatorsSnapshot['profiles'][number]

const workflow = (
  shareId: string,
  username: string,
  overrides: Partial<Workflow> = {}
): Workflow => ({
  share_id: shareId,
  name: `Workflow ${shareId}`,
  status: 'approved',
  is_app: false,
  publish_time: '2026-09-01T10:00:00Z',
  profile: { username },
  ...overrides
})

const onlyCreator = (profile: Profile, workflows = [workflow('a1', 'purz')]) =>
  hubCreators({
    fetched_at: '2026-10-20T00:00:00Z',
    profiles: [profile],
    workflows
  })

describe('hubCreators', () => {
  it('lists each creator with an approved workflow, busiest first', () => {
    const creators = hubCreators({
      fetched_at: '2026-10-20T00:00:00Z',
      profiles: [
        { username: 'sirolim', display_name: 'Sirolim' },
        { username: 'purz' },
        { username: 'hellorob', display_name: 'Rob' },
        { username: 'idle', display_name: 'No workflows' }
      ],
      workflows: [
        workflow('a1', 'sirolim'),
        workflow('b1', 'purz'),
        workflow('b2', 'purz'),
        workflow('c1', 'hellorob'),
        workflow('c2', 'hellorob', { status: 'pending' }),
        workflow('d1', 'idle', { status: 'rejected' })
      ]
    })

    expect(
      creators.map(({ username, displayName, workflows }) => [
        username,
        displayName,
        workflows.map(({ share_id }) => share_id)
      ])
    ).toEqual([
      ['purz', 'purz', ['b1', 'b2']],
      ['hellorob', 'Rob', ['c1']],
      ['sirolim', 'Sirolim', ['a1']]
    ])
  })

  it('lowercases the username so every link to the creator agrees', () => {
    const creators = onlyCreator({ username: 'PurZ' }, [
      workflow('a1', 'PurZ'),
      workflow('a2', 'purz')
    ])

    expect(
      creators.map(({ username, displayName, workflows }) => [
        username,
        displayName,
        workflows.map(({ share_id }) => share_id)
      ])
    ).toEqual([['purz', 'PurZ', ['a1', 'a2']]])
  })

  it('keeps only web links', () => {
    const [only] = onlyCreator({
      username: 'purz',
      website_urls: ['https://purz.xyz', 'javascript:alert(1)', 'purz.xyz']
    })

    expect(only.websiteUrls).toEqual(['https://purz.xyz'])
  })

  it.for([
    {
      case: 'resizes an avatar on the Hub assets host',
      avatar: 'https://comfy-hub-assets.comfy.org/uploads/purz.png',
      expected:
        'https://comfy-hub-assets.comfy.org/cdn-cgi/image/width=400,format=auto,quality=82/uploads/purz.png'
    },
    {
      case: 'drops an avatar served over plain http',
      avatar: 'http://comfy-hub-assets.comfy.org/uploads/purz.png',
      expected: undefined
    },
    {
      case: 'drops an avatar on another host',
      avatar: 'https://tracker.example/purz.png',
      expected: undefined
    },
    {
      case: 'drops an avatar that is not a web URL',
      avatar: 'javascript:alert(1)',
      expected: undefined
    }
  ])('$case', ({ avatar, expected }) => {
    const [only] = onlyCreator({ username: 'purz', avatar_url: avatar })

    expect(only.avatarUrl).toBe(expected)
  })
})

const creator = (overrides: Partial<HubCreator> = {}): HubCreator => ({
  username: 'purz',
  displayName: 'Purz',
  websiteUrls: [],
  workflows: [
    workflow('aaaaaaaaaaaa', 'purz'),
    workflow('bbbbbbbbbbbb', 'purz')
  ],
  ...overrides
})

describe('creatorWorkflowTemplate', () => {
  const asset = 'https://comfy-hub-assets.comfy.org'
  const still = `${asset}/cdn-cgi/image/width=640,format=auto,quality=82`

  it.for([
    {
      case: 'a resized image',
      files: { thumbnail_url: `${asset}/uploads/a.png` },
      expected: { mediaType: 'image', thumbnails: [`${still}/uploads/a.png`] }
    },
    {
      case: 'an image from another host as it is',
      files: { thumbnail_url: 'https://cdn.example/a.webp' },
      expected: {
        mediaType: 'image',
        thumbnails: ['https://cdn.example/a.webp']
      }
    },
    {
      case: 'a frame of a video',
      files: { thumbnail_url: `${asset}/uploads/a.mp4` },
      expected: {
        mediaType: 'video',
        thumbnails: [`${asset}/cdn-cgi/media/mode=frame,time=1s/uploads/a.mp4`]
      }
    },
    {
      case: 'nothing for a video no host can take a frame of',
      files: { thumbnail_url: 'https://cdn.example/a.mp4' },
      expected: { mediaType: 'video', thumbnails: [] }
    },
    {
      case: 'a before and after pair',
      files: {
        thumbnail_url: `${asset}/uploads/after.png`,
        thumbnail_comparison_url: `${asset}/uploads/before.jpg`
      },
      expected: {
        mediaType: 'image',
        thumbnails: [
          `${still}/uploads/after.png`,
          `${still}/uploads/before.jpg`
        ],
        thumbnailVariant: 'compareSlider'
      }
    },
    {
      case: 'one image when the pair ends in a video',
      files: {
        thumbnail_url: `${asset}/uploads/after.png`,
        thumbnail_comparison_url: `${asset}/uploads/before.mp4`
      },
      expected: {
        mediaType: 'image',
        thumbnails: [`${still}/uploads/after.png`]
      }
    },
    {
      case: 'nothing for an audio file',
      files: { thumbnail_url: `${asset}/uploads/a.mp3` },
      expected: { mediaType: 'image', thumbnails: [] }
    }
  ])('shows $case', ({ files, expected }) => {
    const { mediaType, thumbnails, thumbnailVariant } = creatorWorkflowTemplate(
      workflow('aaaaaaaaaaaa', 'purz', files)
    )
    expect({ mediaType, thumbnails, thumbnailVariant }).toEqual(expected)
  })
})

describe('creatorEntityNode', () => {
  const siteUrl = 'https://comfy.org'
  const url = 'https://comfy.org/hub/creators/purz/'

  it.for([
    { username: 'comfyui', type: 'Organization' },
    { username: 'purz', type: 'Person' }
  ])('describes $username as a $type', ({ username, type }) => {
    expect(
      creatorEntityNode(creator({ username }), url, siteUrl)['@type']
    ).toBe(type)
  })

  it('names the profile and links its sites', () => {
    expect(
      creatorEntityNode(
        creator({
          description: 'Live stream host',
          avatarUrl: 'https://cdn/purz.png',
          websiteUrls: ['https://purz.xyz']
        }),
        url,
        siteUrl
      )
    ).toEqual({
      '@type': 'Person',
      '@id': `${url}#creator`,
      name: 'Purz',
      alternateName: 'purz',
      url,
      description: 'Live stream host',
      image: 'https://cdn/purz.png',
      sameAs: ['https://purz.xyz']
    })
  })

  it('ties the Comfy creator to the site organization', () => {
    const node = creatorEntityNode(
      creator({ username: 'comfyui', websiteUrls: ['https://www.comfy.org'] }),
      url,
      siteUrl
    )

    expect(node.sameAs).toEqual([
      'https://comfy.org/#organization',
      'https://www.comfy.org'
    ])
  })

  it('leaves out fields the profile does not have', () => {
    const node = creatorEntityNode(creator(), url, siteUrl)
    expect(node).not.toHaveProperty('description')
    expect(node).not.toHaveProperty('image')
    expect(node).not.toHaveProperty('sameAs')
  })
})

describe('creatorMetaDescription', () => {
  const summary = 'Browse 2 ComfyUI workflows by Purz on the Comfy Hub.'

  it.for([
    { case: 'no bio', bio: undefined, expected: summary },
    {
      case: 'a bio over several lines',
      bio: 'Live stream host.\n\nVJ   and artist.',
      expected: `${summary} Live stream host. VJ and artist.`
    },
    {
      case: 'a long bio',
      bio: 'I make generative video tools and teach them on stream every week. '.repeat(
        3
      ),
      expected: `${summary} I make generative video tools and teach them on stream every week. I make generative video tools and…`
    }
  ])('describes a creator with $case', ({ bio, expected }) => {
    const description = creatorMetaDescription(summary, bio)

    expect(description).toBe(expected)
    expect(description.length).toBeLessThanOrEqual(160)
  })
})
