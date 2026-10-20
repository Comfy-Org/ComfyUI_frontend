import { describe, expect, it } from 'vitest'

import type { HubCreatorsSnapshot } from './creators'
import { hubCreators } from './creators'

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
