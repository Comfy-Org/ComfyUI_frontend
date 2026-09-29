import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { BUILD_ASSETS_DIR } from './build'

const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const robotsTxt = readFileSync(
  join(websiteRoot, 'public', 'robots.txt'),
  'utf8'
)

interface Rule {
  allow: boolean
  pattern: string
}

interface Group {
  agents: string[]
  rules: Rule[]
}

function parseGroups(text: string): Group[] {
  const groups: Group[] = []
  for (const line of text.split('\n')) {
    const match = /^\s*([a-z-]+)\s*:\s*(\S*)/i.exec(line)
    if (!match) continue
    const [, field, value] = match
    const key = field.toLowerCase()
    const current = groups.at(-1)
    if (key === 'user-agent') {
      if (current && current.rules.length === 0) {
        current.agents.push(value.toLowerCase())
      } else {
        groups.push({ agents: [value.toLowerCase()], rules: [] })
      }
    } else if ((key === 'allow' || key === 'disallow') && current && value) {
      current.rules.push({ allow: key === 'allow', pattern: value })
    }
  }
  return groups
}

function patternMatches(pattern: string, path: string) {
  const anchored = pattern.endsWith('$')
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path)
}

function isAllowed(agent: string, path: string) {
  const groups = parseGroups(robotsTxt)
  const group =
    groups.find((g) => g.agents.includes(agent.toLowerCase())) ??
    groups.find((g) => g.agents.includes('*'))
  const winner = (group?.rules ?? [])
    .filter((rule) => patternMatches(rule.pattern, path))
    .sort(
      (a, b) =>
        b.pattern.length - a.pattern.length || Number(b.allow) - Number(a.allow)
    )
    .at(0)
  return winner?.allow ?? true
}

describe('robots.txt', () => {
  it.for([
    { agent: 'Googlebot', path: `/${BUILD_ASSETS_DIR}/page.Ab12Cd34.js` },
    { agent: 'Googlebot', path: `/${BUILD_ASSETS_DIR}/index.Ab12Cd34.css` },
    { agent: 'Googlebot', path: '/_astro/page.Ab12Cd34.js' },
    { agent: 'Bingbot', path: `/${BUILD_ASSETS_DIR}/page.Ab12Cd34.js` }
  ])('lets $agent fetch $path', ({ agent, path }) => {
    expect(isAllowed(agent, path)).toBe(true)
  })

  it('still keeps crawlers out of Vercel internals', () => {
    expect(isAllowed('Googlebot', '/_vercel/insights/script.js')).toBe(false)
  })
})
