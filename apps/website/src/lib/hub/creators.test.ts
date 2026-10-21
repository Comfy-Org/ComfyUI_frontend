import { describe, expect, it } from 'vitest'

import type { HubCreator } from './creators'
import {
  creatorEntityNode,
  creatorMetaDescription,
  isHttpsUrl
} from './creators'

const creator = (overrides: Partial<HubCreator> = {}): HubCreator => ({
  username: 'purz',
  displayName: 'Purz',
  websiteUrls: [],
  ...overrides
})

describe('isHttpsUrl', () => {
  it.for([
    { url: 'https://purz.xyz', valid: true },
    { url: 'http://purz.xyz', valid: false },
    { url: 'javascript:alert(1)', valid: false },
    { url: 'purz.xyz', valid: false }
  ])('accepts $url: $valid', ({ url, valid }) => {
    expect(isHttpsUrl(url)).toBe(valid)
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
  const summary = 'Browse ComfyUI workflows by Purz on the Comfy Hub.'

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
      expected: `${summary} I make generative video tools and teach them on stream every week. I make generative video tools and teach…`
    }
  ])('describes a creator with $case', ({ bio, expected }) => {
    const description = creatorMetaDescription(summary, bio)

    expect(description).toBe(expected)
    expect(description.length).toBeLessThanOrEqual(160)
  })
})
