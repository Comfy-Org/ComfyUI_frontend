import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const robotsTxt = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../public/robots.txt'),
  'utf8'
)

const rulesFor = (directive: string) =>
  robotsTxt
    .split('\n')
    .flatMap(
      (line) =>
        new RegExp(`^${directive}:\\s*(\\S+)`, 'i').exec(line)?.[1] ?? []
    )

describe('robots.txt', () => {
  it('disallows only /_vercel/, so crawlers can fetch the /_astro/ and /_website/ assets', () => {
    expect(rulesFor('disallow')).toEqual(['/_vercel/'])
  })

  it('still allows the whole site', () => {
    expect(rulesFor('allow')).toContain('/')
  })
})
