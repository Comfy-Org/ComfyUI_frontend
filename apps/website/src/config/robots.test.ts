import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { websiteRoot } from '@website/paths'

const robotsTxt = readFileSync(join(websiteRoot, 'public/robots.txt'), 'utf8')

const rulesFor = (directive: string) =>
  robotsTxt
    .split('\n')
    .flatMap(
      (line) =>
        new RegExp(`^\\s*${directive}\\s*:\\s*(\\S+)`, 'i').exec(line)?.[1] ??
        []
    )

describe('robots.txt', () => {
  it('disallows only /_vercel/, so crawlers can fetch the /_astro/ and /_website/ assets', () => {
    expect(rulesFor('disallow')).toEqual(['/_vercel/'])
  })

  it('still allows the whole site', () => {
    expect(rulesFor('allow')).toContain('/')
  })
})
