import { describe, expect, it, vi } from 'vitest'

import { expectedCharge, liveSettings } from '../acceptance/settings'

describe('live acceptance destinations', () => {
  it.for([
    ['prod', 'https://comfy.org', 'https://api.comfy.org'],
    ['prod', 'https://www.comfy.org', 'https://api.comfy.org'],
    [
      'test',
      'https://comfy-website-preview-pr-123.vercel.app',
      'https://testapi.comfy.org'
    ],
    [
      'staging',
      'https://comfy-website-preview-pr-123.vercel.app',
      'https://stagingapi.comfy.org'
    ]
  ])('pairs %s with its own backend', ([environment, site, router]) => {
    expect(
      liveSettings(
        {
          PUBLIC_WORKSHOP_CLOUD_ENV: environment,
          WORKSHOP_SITE_URL: site
        },
        {
          prod: ['https://comfy.org', 'https://www.comfy.org'],
          test: ['https://comfy-website-preview-pr-123.vercel.app'],
          staging: ['https://comfy-website-preview-pr-123.vercel.app']
        }
      )
    ).toMatchObject({ site, router })
  })

  it.for([
    ['test', 'https://comfy.org'],
    ['prod', 'https://preview.vercel.app'],
    ['test', 'https://attacker.example'],
    ['test', 'https://attacker.vercel.app'],
    ['test', 'https://comfy-website-preview-pr-123.vercel.app'],
    ['prod', 'https://comfy.org:444'],
    ['test', 'https://preview.vercel.app.attacker.example'],
    ['prod', 'http://comfy.org'],
    ['prod', 'https://user:password@comfy.org'],
    ['prod', 'https://comfy.org/path'],
    ['prod', 'https://comfy.org/?token=secret'],
    ['missing', 'https://comfy.org']
  ])(
    'rejects mismatched or unsafe destination %s %s',
    ([environment, site]) => {
      expect(() =>
        liveSettings({
          PUBLIC_WORKSHOP_CLOUD_ENV: environment,
          WORKSHOP_SITE_URL: site
        })
      ).toThrow()
    }
  )
})

describe('reviewed billing expectations', () => {
  it('requires the price for the exact page and input variant', () => {
    vi.stubEnv('WORKSHOP_EXPECTED_CHARGES_JSON', '{"image/own":4.5}')
    expect(expectedCharge('image', 'own')).toBe(4.5)
    expect(() => expectedCharge('image', 'advanced')).toThrow(
      'Missing reviewed charge'
    )
  })

  it.for(['{}', '{"image/own":0}', '{"image/own":-1}', '{"image/own":"4.5"}'])(
    'cannot pass with an absent or invalid price: %s',
    (json) => {
      vi.stubEnv('WORKSHOP_EXPECTED_CHARGES_JSON', json)
      expect(() => expectedCharge('image', 'own')).toThrow()
    }
  )
})
